# Restora — Free deployment (single VM + HTTPS, $0)

Get Restora **online with real HTTPS for free**, by running the whole stack
(LocalStack included, so **no AWS bill**) on one free virtual machine, with
**Caddy** auto-provisioning a Let's Encrypt certificate.

> **What this is:** a free, shareable, HTTPS *showcase* deployment. The "cloud"
> (S3/SQS/Secrets/SES) is LocalStack running on the same box — perfect for demos
> and portfolios. For real customer data at scale you'd use the paid AWS path
> (`docs/DEPLOY.md` + `infra/terraform/`).

---

## What you need (all free)
- A **free VM** — [Oracle Cloud Always Free](https://www.oracle.com/cloud/free/)
  is the best truly-always-free option (an Ampere VM with 1–4 vCPU). Alternatives:
  Google Cloud / AWS free trials, or any cheap $5 VPS.
- A **free subdomain** — [DuckDNS](https://www.duckdns.org) gives you
  `something.duckdns.org` for free.

## Steps

### 1. Create the VM and open ports
Provision an Ubuntu VM (≥ 2 GB RAM; 4 GB comfortable). In the cloud firewall /
security list **and** the OS firewall, allow inbound **80** and **443**:

```bash
sudo ufw allow 80,443/tcp && sudo ufw --force enable
```

### 2. Install Docker
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

### 3. Point a free domain at the VM
On [duckdns.org](https://www.duckdns.org): sign in, create a subdomain, and set
its IP to your VM's **public IP**. Confirm it resolves:
```bash
dig +short your-name.duckdns.org   # should print the VM IP
```

### 4. Get the code onto the VM
```bash
git clone <your-repo-url> vaultsync && cd vaultsync
# (or: scp the vaultsync/ folder up)
```

### 5. Configure secrets
```bash
cp .env.deploy.example .env
nano .env   # set DOMAIN, then:
#   JWT_SECRET=$(openssl rand -hex 32)
#   POSTGRES_PASSWORD=$(openssl rand -base64 24)
```

### 6. Launch 🚀
```bash
docker compose -f docker-compose.yml \
               -f docker-compose.prod.yml \
               -f docker-compose.caddy.yml up -d --build
```
First boot takes a few minutes (image pulls + Let's Encrypt issuance). Then open:

**https://your-name.duckdns.org**

Log in with the seeded **admin** account and **immediately create your own user
and delete/replace the demo accounts** (Users page, SysAdmin):

| Role | Login |
|------|-------|
| SysAdmin | `admin@vaultsync.io` / `admin123` |

### 7. Verify
```bash
curl -fsS https://your-name.duckdns.org/health   # {"status":"ok"}
docker compose logs validator | grep PASS | tail   # backups validating
```

## Operating it
```bash
docker compose ... logs -f api          # tail logs
docker compose ... ps                   # status
docker compose ... down                 # stop
docker compose ... up -d                # start
```
(Use the same three `-f` files each time.)

## Honest caveats
- **Demo backend:** S3/SQS/Secrets/SES are LocalStack on the box, not real AWS.
  Alert *emails* are captured by LocalStack, not actually delivered. In-app alerts
  work fully.
- **Persistence:** backup history (Postgres) persists in Docker volumes; LocalStack
  state is best-effort across restarts — fine for a demo, not for production SLAs.
- **One box = no HA.** If the VM dies, so does the demo. That's the trade-off for free.
- **Change the demo credentials** before sharing the URL publicly.
- For production with real data: follow `docs/DEPLOY.md` (paid AWS) instead.
