#!/usr/bin/env bash
# Backs up the backend_uploads Docker volume (user-uploaded tree/kit photos)
# to a local tarball, keeping the last N days. Meant to run daily via cron
# on the VPS host — the volume itself has no other durability guarantee.
#
# Usage: docker/backup-uploads.sh [backup_dir] [keep_days]

set -euo pipefail

BACKUP_DIR="${1:-/root/backups/sprouty-uploads}"
KEEP_DAYS="${2:-14}"

VOLUME_NAME="$(docker volume ls --filter name=backend_uploads --format '{{.Name}}' | head -n1)"
if [ -z "$VOLUME_NAME" ]; then
  echo "FATAL: no docker volume matching 'backend_uploads' found. Run 'docker volume ls' to check." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/uploads-$STAMP.tar.gz"

echo "Backing up volume '$VOLUME_NAME' -> $DEST"
docker run --rm \
  -v "$VOLUME_NAME:/data:ro" \
  -v "$BACKUP_DIR:/backup" \
  alpine \
  sh -c "tar czf /backup/uploads-$STAMP.tar.gz -C /data ."

echo "Done: $(du -h "$DEST" | cut -f1)"

echo "Pruning backups older than $KEEP_DAYS days in $BACKUP_DIR"
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime "+$KEEP_DAYS" -print -delete
