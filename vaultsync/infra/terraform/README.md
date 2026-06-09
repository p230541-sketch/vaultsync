# Restora — AWS infrastructure (Terraform)

Provisions the managed AWS services Restora needs — the real-cloud equivalent
of what `infra/localstack/bootstrap.sh` fakes locally.

## What it creates

| Resource | Notes |
|----------|-------|
| **S3 bucket** | Private (public access blocked), KMS-encrypted, versioned, with a `backups/` retention lifecycle |
| **SQS queue + DLQ** | S3→SQS notification drives the validator; poison messages dead-letter after 5 receives |
| **Secrets Manager secret** | AES-256 key (64 hex chars); `ignore_changes` so the app's rotate-key action isn't clobbered |
| **SES email identity** | Sender for alert emails (requires verification + sandbox exit) |
| **RDS Postgres 16** | Telemetry DB — encrypted, automated backups, deletion-protected |
| **IAM policy + task role** | Least-privilege S3/SQS/Secrets/SES access, assumable by ECS tasks |

## Scope

This module covers the **stateful data plane**. Compute & networking
(VPC, ECS/Fargate or EC2, the ALB + ACM certificate) are intentionally **not**
included — they vary too much per org. Bring your own VPC (pass `vpc_subnet_ids`
/ `vpc_security_group_ids`) and run the container images per `docs/DEPLOY.md`.

## Usage

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # then edit
export TF_VAR_db_password="$(openssl rand -base64 24)"

terraform init
terraform plan     # REVIEW THIS against your account before applying
terraform apply
terraform output   # values map onto the app env vars (see docs/DEPLOY.md)
```

> ⚠️ This IaC has been hand-reviewed but **not** applied against a live account
> here. Always read the `terraform plan` before `apply`, and expect to tune
> instance sizes, `multi_az`, and the SES identity (domain vs email) for your
> environment. RDS + NAT + KMS incur real cost.
