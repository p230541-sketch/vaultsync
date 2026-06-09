# Restora — Production Deployment Guide

This is the path from the local LocalStack demo to a real AWS deployment. The
application code does **not** change — deploying is configuration: point the same
container images at real AWS services and a real Postgres, behind TLS.

## Prerequisites

- An AWS account + `aws` CLI configured, and `terraform` ≥ 1.5
- A VPC with private subnets and a security group allowing the app → RDS:5432
- A container registry (ECR) and somewhere to run containers (ECS Fargate, EC2, or EKS)
- A domain + an ACM certificate for TLS

## 1. Provision AWS infrastructure

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # edit values
export TF_VAR_db_password="$(openssl rand -base64 24)"
terraform init && terraform plan && terraform apply
terraform output
```

## 2. Build & push images

```bash
# one repo per service
for svc in edge-node cloud-engine/validator cloud-engine/api control-panel; do
  name=$(basename "$svc")
  aws ecr create-repository --repository-name "vaultsync/$name" 2>/dev/null || true
  docker build -t "$ECR/vaultsync/$name:latest" "vaultsync/$svc"
  docker push "$ECR/vaultsync/$name:latest"
done
```

## 3. Map Terraform outputs → environment

Set these from `terraform output` (and your secrets) on the api/validator/edge tasks.
**Leave `AWS_ENDPOINT_URL` empty** so the SDKs hit real AWS, and attach the
`app_task_role_arn` IAM role instead of static keys.

| Env var | Source |
|---------|--------|
| `S3_BUCKET` | `backup_bucket` |
| `SQS_QUEUE_URL` | `sqs_queue_url` |
| `SECRET_ID` | `secret_id` |
| `TELEMETRY_DB_DSN` | `postgres://vaultsync:<db_password>@<telemetry_db_endpoint>/telemetry?sslmode=require` |
| `ALERT_FROM_EMAIL` | `alert_from_identity` (verify it first) |
| `JWT_SECRET` | `openssl rand -hex 32` → store in Secrets Manager |
| `NODE_ENV` | `production` (enables the API's fail-closed config checks) |
| `PG_SSLMODE` | `require` |
| `AWS_REGION` | your region |
| `AWS_ENDPOINT_URL` | **unset** |

Run with the production compose overlay if self-hosting on a VM:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

(For ECS, translate the same env + the task role into task definitions. Drop the
`localstack` and `bootstrap` services — real AWS replaces them.)

## 4. Initialize the telemetry schema

The local stack auto-runs `infra/db/telemetry_schema.sql` on first boot; against
RDS, apply it once:

```bash
psql "postgres://vaultsync:<pw>@<telemetry_db_endpoint>/telemetry?sslmode=require" \
  -f infra/db/telemetry_schema.sql
```

## 5. TLS & the edge nodes

- **TLS** terminates at the **ALB** with the **ACM certificate** (or a reverse
  proxy like Caddy if self-hosting). The app already trusts `X-Forwarded-Proto`
  and sets `Secure` cookies when `NODE_ENV=production`.
- **Edge daemons** run next to each database you protect. Point `SOURCE_DB_DSN`
  at that database and `API_URL` at the deployed API. Provision the node from the
  dashboard (Users/SysAdmin) or insert it directly.

## 6. Smoke test (post-deploy)

```bash
curl -fsS https://vaultsync.example.com/api/../health     # api liveness
curl -fsS https://vaultsync.example.com/api/.../ready      # readiness (DB)
# log in, trigger a backup, confirm it reaches PASS in the dashboard
```

## 7. Disaster-recovery drill (do this before you rely on it)

See `docs/RUNBOOK.md` — restore a backup `.enc` into a scratch database and
diff it against source. A backup you have never restored is a hope, not a backup.

---

### Still required before serving real customer data
- A human **security review / pen test** (not something IaC provides)
- **SES production access** (sandbox only emails verified addresses)
- A rehearsed **restore drill** at realistic data size
- Monitoring/log aggregation (CloudWatch/Datadog) wired to the `/ready` probe and alerts
