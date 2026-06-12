#!/usr/bin/env sh
# RE-OS — Automated Postgres backup (P0-6)
#
# Produces a compressed, timestamped pg_dump custom-format archive, prunes
# backups older than the retention window, and (optionally) uploads to S3.
#
# Designed to run inside a postgres:16-alpine container or any host with the
# Postgres 16 client tools + (optionally) the AWS CLI installed.
#
# Required environment:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
#     -- OR -- DATABASE_URL=postgresql://user:pass@host:port/db
#
# Optional environment:
#   BACKUP_DIR              Local backup directory      (default: /backups)
#   BACKUP_RETENTION_DAYS   Prune dumps older than N    (default: 7)
#   BACKUP_S3_BUCKET        s3://bucket/prefix to mirror to (default: unset)
#
# Exit codes: 0 success, non-zero on failure (suitable for cron alerting).

set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

log() { printf '%s [db-backup] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Derive PG* connection vars from DATABASE_URL when provided.
if [ -n "${DATABASE_URL:-}" ]; then
  # postgresql://user:pass@host:port/dbname?params
  url_no_scheme="${DATABASE_URL#*://}"
  creds="${url_no_scheme%%@*}"
  hostpart="${url_no_scheme#*@}"
  PGUSER="${PGUSER:-${creds%%:*}}"
  PGPASSWORD="${PGPASSWORD:-${creds#*:}}"
  hostport="${hostpart%%/*}"
  PGHOST="${PGHOST:-${hostport%%:*}}"
  _port="${hostport#*:}"
  [ "$_port" = "$hostport" ] && _port=5432
  PGPORT="${PGPORT:-$_port}"
  dbpart="${hostpart#*/}"
  PGDATABASE="${PGDATABASE:-${dbpart%%\?*}}"
  export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE
fi

: "${PGHOST:?PGHOST or DATABASE_URL is required}"
: "${PGUSER:?PGUSER or DATABASE_URL is required}"
: "${PGDATABASE:?PGDATABASE or DATABASE_URL is required}"
PGPORT="${PGPORT:-5432}"

mkdir -p "$BACKUP_DIR"
ARCHIVE="${BACKUP_DIR}/reos-${PGDATABASE}-${TIMESTAMP}.dump"

log "Starting backup of ${PGDATABASE}@${PGHOST}:${PGPORT} -> ${ARCHIVE}"
# -Fc = custom format (compressed, restorable selectively with pg_restore).
pg_dump --format=custom --no-owner --no-privileges --file "$ARCHIVE"
log "Backup written ($(wc -c < "$ARCHIVE") bytes)"

# Integrity check: pg_restore --list must parse the archive table of contents.
pg_restore --list "$ARCHIVE" >/dev/null
log "Archive verified with pg_restore --list"

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    log "Uploading to ${BACKUP_S3_BUCKET}"
    aws s3 cp "$ARCHIVE" "${BACKUP_S3_BUCKET%/}/$(basename "$ARCHIVE")"
    log "Upload complete"
  else
    log "WARNING: BACKUP_S3_BUCKET set but aws CLI not found; skipping upload"
  fi
fi

# Prune local archives older than the retention window.
log "Pruning local backups older than ${RETENTION_DAYS} day(s)"
find "$BACKUP_DIR" -name 'reos-*.dump' -type f -mtime "+${RETENTION_DAYS}" -print -delete || true

log "Done"
