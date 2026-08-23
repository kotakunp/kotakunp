#!/usr/bin/env bash
# Restore a backup into a temp dir and verify integrity. Never touches live paths.
set -euo pipefail

BACKUP_DIR="${1:?Usage: restore-check.sh <backup-directory>}"
[ -d "$BACKUP_DIR" ] || { echo "No such backup directory: $BACKUP_DIR"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -R "$BACKUP_DIR"/. "$WORK"/
cd "$WORK"
sha256sum -c SHA256SUMS
if [ -f uploads.tar.gz ]; then tar -xzf uploads.tar.gz; fi
sqlite3 content.sqlite "PRAGMA integrity_check;"
sqlite3 content.sqlite "SELECT 'posts', COUNT(*) FROM journal_posts UNION ALL SELECT 'releases', COUNT(*) FROM music_releases UNION ALL SELECT 'media', COUNT(*) FROM media;"
echo "restore-check OK ($WORK used, removed on exit)"
