# Restora

**A hybrid-cloud disaster-recovery platform that backs up databases, _proves each
backup is restorable_, and reports health — encrypted end-to-end.**

Most backup tools tell you a file exists. Restora goes further: every backup is
automatically decrypted into a throwaway database, integrity-checked, and torn
down — so you have evidence you can actually recover, not just hope.

---

## How it works

```
 source DB ──► edge daemon (Go) ──────────► S3 ──(event)──► SQS ──► validator (Node/TS)
 (your data)   pg_dump → gzip →             encrypted        │       ├─ decrypt → gunzip
               AES-256-GCM encrypt →         object           │       ├─ import into ephemeral PG
               spool → upload                                 │       ├─ integrity check (content hash)
                                                              │       └─ drop ephemeral DB
                                                              ▼
 control panel (React) ◄── API (Express) ◄──────────── telemetry DB (Postgres)
   dashboard / RBAC          JWT cookie auth, RBAC, alerts,
                             audit log, key rotation, retention, SES
```

1. **Edge daemon** dumps the source database (`pg_dump`), **gzips** it, **AES-256-GCM
   encrypts** it (key from Secrets Manager), spools to disk, and uploads to S3.
   *Encryption happens before upload — storage only ever holds ciphertext.*
2. An **S3 → SQS** event wakes the **validator**, which decrypts in memory,
   imports the dump into an **ephemeral Postgres**, runs **content-hash integrity
   checks**, records the result, and drops the scratch DB.
3. The **API** serves that telemetry to a **React dashboard** with auth, RBAC,
   alerts, an audit trail, key rotation, and retention controls.

## Features

- **Validated backups** — restorability is proven every run, not assumed
- **Client-side AES-256-GCM** encryption + **gzip** compression (~77% smaller)
- **Auth & RBAC** — JWT in an httpOnly cookie + CSRF; roles: `SysAdmin` /
  `BusinessOwner` / `ReadOnly`
- **Alerts** (failure / latency-SLA / stale-node) surfaced in-app and via **SES email**
- **Audit log** of every privileged action
- **Key rotation**, **S3 retention lifecycle**, **manual trigger**, live node metrics
- **Stale-node detection**, **graceful shutdown**, `/health` + `/ready` probes

## Tech stack

| Layer | Tech |
|-------|------|
| Edge daemon | Go (aws-sdk-go-v2, robfig/cron) |
| Validator + API | Node.js / TypeScript (Express, pg, AWS SDK v3) |
| Dashboard | React 18 + Vite + TypeScript |
| Cloud (local) | Docker Compose + LocalStack (S3/SQS/Secrets/SES) |
| Cloud (prod) | Terraform → real AWS (see `infra/terraform/`) |

## Quick start (local)

```bash
cd vaultsync
docker compose up --build
```

Open **http://localhost:5173** and sign in:

| Role | Login |
|------|-------|
| SysAdmin | `admin@vaultsync.io` / `admin123` |
| BusinessOwner | `owner@vaultsync.io` / `owner123` |
| ReadOnly | `viewer@vaultsync.io` / `viewer123` |

The stack provisions itself (LocalStack bucket/queue/secret/SES) and starts taking
backups every 2 minutes. Watch them reach **PASS** in the dashboard.

## Tests

```bash
cd cloud-engine/api && npm test          # auth / RBAC (jest)
cd cloud-engine/validator && npm test    # crypto round-trip (jest)
cd control-panel && npm test             # format / cron (vitest)
```

26 unit tests; CI (`.github/workflows/ci.yml`) typechecks + tests every package
and builds the images on push/PR.

## Project structure

```
vaultsync/
├── edge-node/            Go backup daemon
├── cloud-engine/
│   ├── api/              Express API (auth, RBAC, alerts, audit, settings…)
│   └── validator/        SQS worker: decrypt → validate → telemetry
├── control-panel/        React dashboard
├── infra/
│   ├── db/               telemetry schema + source seed
│   ├── localstack/       local AWS bootstrap
│   └── terraform/        real-AWS IaC (S3/SQS/Secrets/SES/RDS/IAM)
├── docs/
│   ├── DEPLOY.md         production deployment guide
│   └── RUNBOOK.md        DR drill + operations
├── docker-compose.yml            local stack
└── docker-compose.prod.yml       production overrides
```

## Production

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for the full AWS deployment path and
**[docs/RUNBOOK.md](docs/RUNBOOK.md)** for the disaster-recovery drill and
operations. Production hardening (externalized secrets, fail-closed config, TLS,
cookie auth, rate limiting, observability) is built in; the remaining steps are
operational (real AWS account, domain/TLS cert, security review, restore drill).

## Security notes

- Backups are encrypted **before** leaving the node; S3 holds only ciphertext.
- Auth token lives in an **httpOnly cookie** (not `localStorage`) with CSRF
  double-submit protection; `Secure` cookies + TLS in production.
- The API **refuses to boot in production** with default secrets.
- Losing the emergency decryption key means permanent data loss — store it offline.
