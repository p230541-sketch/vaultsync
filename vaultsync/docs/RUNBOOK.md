# Restora — Operations Runbook

Procedures for running Restora in production. The most important one is the
**DR restore drill** — a backup you have never restored is a hope, not a backup.

---

## 1. Disaster-recovery restore drill ⭐

Restora validates restorability automatically on every backup, but you should
still rehearse a **manual full restore** end-to-end before relying on it, and on a
schedule (e.g. quarterly).

### Restore a backup object by hand

```bash
# 1. Pick a backup object (from the dashboard's S3 key, or list the bucket)
KEY="backups/<node-id>/<node-id>_<timestamp>.enc"
aws s3 cp "s3://$S3_BUCKET/$KEY" backup.enc

# 2. Fetch the AES key (hex) from Secrets Manager
KEY_HEX=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" \
          --query SecretString --output text)

# 3. Decrypt + decompress  (wire format: nonce[12] | ciphertext | tag[16], then gzip)
python3 - "$KEY_HEX" backup.enc <<'PY'
import sys, gzip
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
key = bytes.fromhex(sys.argv[1]); blob = open(sys.argv[2],'rb').read()
nonce, ct = blob[:12], blob[12:]
plain = AESGCM(key).decrypt(nonce, ct, None)
open('dump.sql','wb').write(gzip.decompress(plain))
print("wrote dump.sql")
PY

# 4. Restore into a scratch database and verify
createdb restore_test
psql restore_test -f dump.sql
psql restore_test -c "\dt"          # tables present?
psql restore_test -c "SELECT count(*) FROM <a-known-table>;"
```

### Acceptance criteria
- `dump.sql` restores without errors
- Row counts / spot-checked rows match the source at backup time
- Record the drill date, object restored, and result

> If decryption fails: confirm you used the key version that was **current when the
> backup was taken**. Rotating the key does not re-encrypt old objects — keep the
> previous key (the emergency key on the Security Keys page) safe.

---

## 2. Key rotation

- **Routine:** dashboard → **Security Keys → Rotate Key Now** (SysAdmin). New
  backups use the new key; the rotation is audit-logged.
- **Before rotating,** download/print the current emergency key — older backups
  can only be decrypted with the key that encrypted them.
- Programmatic: `POST /api/keys/rotate` (writes a new `PutSecretValue` version).

## 3. Onboard a new edge node

1. Deploy the `edge-node` image next to the database to protect; set
   `SOURCE_DB_DSN`, `API_URL`, `S3_BUCKET`, `SECRET_ID`, `CRON_SCHEDULE`, `NODE_ID`.
2. Register it: dashboard → **Edge Nodes → Provision New Node** (SysAdmin), or
   `POST /api/nodes`.
3. Confirm a backup reaches **PASS** within one cron cycle.

## 4. Responding to alerts (the bell / Alerts page / email)

| Alert | Likely cause | Action |
|-------|--------------|--------|
| `backup_failure` (critical) | dump/upload/validation error | Check validator + edge logs; inspect the failed object's `error_detail` |
| `node_stale` (warning) | daemon not reporting > 5 min | Check the edge host / network; node auto-recovers on next ping |
| `backup_latency` (warning) | validation slower than SLA | Check validator/DB load; tune `latency_sla_ms` in Settings |

## 5. Protect the telemetry DB itself

The telemetry DB holds backup history, users, audit log, and alerts. On RDS,
rely on **automated backups + PITR** (configured in `infra/terraform/rds.tf`).
Self-hosted: schedule `pg_dump` of the `telemetry` database off-box.

## 6. Scaling notes

- **API** is stateless and can run multiple replicas behind the ALB. The
  stale-sweep job is guarded by a Postgres advisory lock, so only one replica
  runs it per tick.
- **Validator** processes each SQS batch concurrently; scale it out by running
  more instances (SQS distributes messages). Ensure visibility timeout ≥
  validation time (set to 300s in Terraform).
- **Edge daemons** are one-per-protected-database.

## 7. Health & shutdown

- `GET /health` — liveness (process up). `GET /ready` — readiness (DB reachable;
  503 if not). Wire both into the load balancer / orchestrator.
- The API shuts down gracefully on `SIGTERM` (drains connections + pool, 10s cap).
