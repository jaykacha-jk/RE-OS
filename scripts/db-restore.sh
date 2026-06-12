#!/usr/bin/env sh
# RE-OS — Postgres restore (P0-6)
#
# Restores a pg_dump custom-format archive (produced by db-backup.sh) into the
# target database. DESTRUCTIVE: existing objects are dropped and recreated.
#
# Usage:
#   db-restore.sh <path-to-archive.dump>
#
# Connection via PG* vars or DATABASE_URL (same resolution as db-backup.sh).
#
# Safety: requires CONFIRM_RESTORE=yes to proceed, so a stray invocation can
# never silently wipe a database.

set -eu

ARCHIVE="${1:-}"
if [ -z "$ARCHIVE" ]; then
  echo "Usage: db-restore.sh <path-to-archive.dump>" >&2
  exit 64
fi
if [ ! -f "$ARCHIVE" ]; then
  echo "Archive not found: $ARCHIVE" >&2
  exit 66
fi

log() { printf '%s [db-restore] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

if [ -n "${DATABASE_URL:-}" ]; then
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

if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "Refusing to restore into ${PGDATABASE}@${PGHOST}:${PGPORT} without CONFIRM_RESTORE=yes" >&2
  echo "This is DESTRUCTIVE — existing data in ${PGDATABASE} will be replaced." >&2
  exit 1
fi

log "Verifying archive ${ARCHIVE}"
pg_restore --list "$ARCHIVE" >/dev/null

log "Restoring into ${PGDATABASE}@${PGHOST}:${PGPORT} (clean + create)"
# --clean --if-exists drops existing objects first; --no-owner/--no-privileges
# keeps the restore portable across role names. Run single-transaction so a
# failed restore rolls back instead of leaving a half-restored database.
pg_restore \
  --dbname "$PGDATABASE" \
  --clean --if-exists \
  --no-owner --no-privileges \
  --single-transaction \
  "$ARCHIVE"

log "Restore complete. Run 'npm --workspace backend run prisma:migrate:deploy' to confirm schema is current."
