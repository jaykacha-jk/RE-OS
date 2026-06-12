# RE-OS — Postgres Backup & Restore Runbook (P0-6)

**Audience:** on-call / ops. **Goal:** never lose tenant data; restore fast under pressure.

| Target | Value |
|--------|-------|
| RPO (max data loss) | ≤ 1 hour (with hourly backups) / ≤ 24h (daily) |
| RTO (max downtime) | ≤ 4 hours |
| Retention | 7 days local (`BACKUP_RETENTION_DAYS`), longer if mirrored to S3 |
| Format | `pg_dump` custom format (`-Fc`), compressed + selectively restorable |

> Managed Postgres (AWS RDS / Aurora) should **also** have automated daily
> snapshots + PITR enabled. The scripts below are the portable, provider-neutral
> layer and the verification mechanism — they are not a substitute for
> infrastructure-level snapshots on production.

---

## 1. Tooling

| File | Purpose |
|------|---------|
| `scripts/db-backup.sh` | Timestamped `pg_dump -Fc`, integrity check (`pg_restore --list`), retention prune, optional S3 upload |
| `scripts/db-restore.sh` | Guarded `pg_restore` (single-transaction, clean + recreate) |
| `docker-compose.staging.yml` → `backup` service | Containerized backup using `postgres:16-alpine` |

Both scripts resolve the connection from `DATABASE_URL` **or** discrete
`PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE` variables.

---

## 2. Taking a backup

### Via Docker Compose (staging)

```bash
docker compose -f docker-compose.staging.yml run --rm backup
```

Archives land in the `db_backups` volume as `reos-<db>-<UTC-timestamp>.dump`.

### Directly (host with Postgres 16 client tools)

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/reos"
export BACKUP_DIR=/var/backups/reos
export BACKUP_RETENTION_DAYS=7
sh scripts/db-backup.sh
```

### Optional offsite copy

Set `BACKUP_S3_BUCKET=s3://my-bucket/reos-backups` (requires the `aws` CLI and
credentials in the environment). Each archive is mirrored after the local write.

---

## 3. Scheduling (automation)

The `backup` service is **not** started by default. Automate it with one of:

- **Host cron** (recommended for VM/compose deploys):

  ```cron
  # Hourly backup at minute 7
  7 * * * * cd /opt/reos && docker compose -f docker-compose.staging.yml run --rm backup >> /var/log/reos-backup.log 2>&1
  ```

- **Managed scheduler**: ECS Scheduled Task / Kubernetes CronJob running the
  same `scripts/db-backup.sh` against production `DATABASE_URL`.

Alert if the job exits non-zero or no new archive appears within the interval.

---

## 4. Restoring (DESTRUCTIVE)

> Restore **replaces** the target database. Confirm you have the right archive
> and the right `DATABASE_URL` before running.

1. Identify the archive to restore (most recent good one):

   ```bash
   ls -lt /var/backups/reos/        # or: aws s3 ls s3://my-bucket/reos-backups/
   ```

2. (If from S3) pull it down:

   ```bash
   aws s3 cp s3://my-bucket/reos-backups/reos-reos-20260612T020000Z.dump ./restore.dump
   ```

3. Run the guarded restore (note the explicit confirmation flag):

   ```bash
   export DATABASE_URL="postgresql://user:pass@host:5432/reos"
   CONFIRM_RESTORE=yes sh scripts/db-restore.sh ./restore.dump
   ```

   Or inside compose:

   ```bash
   docker compose -f docker-compose.staging.yml run --rm \
     -e CONFIRM_RESTORE=yes -v "$PWD/restore.dump:/restore.dump:ro" \
     backup sh /scripts/db-restore.sh /restore.dump
   ```

4. Re-apply migrations to confirm the schema matches the current release:

   ```bash
   npm --workspace backend run prisma:migrate:deploy
   ```

5. Smoke test: `GET /health` returns `{ "status": "ok" }`, log in, list
   properties for a known tenant, confirm row counts look sane.

---

## 5. Quarterly restore drill (do not skip)

A backup you have never restored is a hope, not a backup.

1. Provision a throwaway Postgres (e.g. `docker run --rm -e POSTGRES_PASSWORD=x -p 5433:5432 postgres:16-alpine`).
2. Restore the latest production archive into it.
3. Run `prisma:migrate:deploy` + the tenant-isolation e2e (`npm --workspace backend run test:e2e:tenant`) pointed at the restored DB.
4. Record the measured RTO and any issues; file follow-ups if RTO > target.

---

## 6. Failure modes & responses

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `pg_dump: connection refused` | DB unreachable / wrong host | Verify `DATABASE_URL`, network/SG, DB up |
| `pg_restore --list` fails | Truncated/corrupt archive | Use previous archive; investigate storage |
| Restore aborts mid-way | Single-transaction rollback (intended) | Fix root cause; data left untouched; retry |
| No new archive in window | Scheduler not firing | Check cron/scheduled task + `/var/log/reos-backup.log` |
