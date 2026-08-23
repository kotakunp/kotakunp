#!/usr/bin/env bash
# Consistent content backup: SQLite DB (WAL-safe) + uploads archive + manifest.
set -euo pipefail

: "${CONTENT_DATABASE_PATH:?Set CONTENT_DATABASE_PATH}"
: "${CONTENT_UPLOADS_PATH:?Set CONTENT_UPLOADS_PATH}"
: "${CONTENT_BACKUP_PATH:?Set CONTENT_BACKUP_PATH}"

case "$CONTENT_DATABASE_PATH" in
  /*) ;;
  *) echo "CONTENT_DATABASE_PATH must be absolute"; exit 1 ;;
esac
[ -f "$CONTENT_DATABASE_PATH" ] || { echo "Database not found: $CONTENT_DATABASE_PATH"; exit 1; }
case "$CONTENT_BACKUP_PATH" in
  "$CONTENT_UPLOADS_PATH"|"$CONTENT_UPLOADS_PATH"/*) echo "Backup dir must not live inside uploads"; exit 1 ;;
esac
mkdir -p "$CONTENT_BACKUP_PATH"

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$CONTENT_BACKUP_PATH/$STAMP"
TMP="$DEST.partial"
mkdir -p "$TMP"

sqlite3 "$CONTENT_DATABASE_PATH" ".backup '$TMP/content.sqlite'"
if [ -d "$CONTENT_UPLOADS_PATH" ]; then
  tar -czf "$TMP/uploads.tar.gz" -C "$(dirname "$CONTENT_UPLOADS_PATH")" "$(basename "$CONTENT_UPLOADS_PATH")"
fi
(cd "$TMP" && sha256sum * > SHA256SUMS)
{
  echo "created: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "database: $CONTENT_DATABASE_PATH"
  echo "uploads: $CONTENT_UPLOADS_PATH"
} > "$TMP/manifest.txt"
mv "$TMP" "$DEST"
echo "Backup written to $DEST"
