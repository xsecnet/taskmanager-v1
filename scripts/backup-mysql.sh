#!/usr/bin/env bash
# Backup MySQL via mysqldump ke folder ./backups (volume yang di-mount).
# Dijalankan dari host lewat cron, mis. tiap jam 02:00:
#   0 2 * * * cd /opt/taskmanager && ./scripts/backup-mysql.sh >> backups/backup.log 2>&1

set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env supaya dapat MYSQL_DATABASE & MYSQL_ROOT_PASSWORD
set -a
# shellcheck disable=SC1091
source .env
set +a

STAMP=$(date +%Y%m%d-%H%M%S)
OUT="backups/${MYSQL_DATABASE}-${STAMP}.sql.gz"
mkdir -p backups

echo "[backup] $(date) → ${OUT}"

docker compose exec -T mysql sh -c \
  "exec mysqldump --single-transaction --quick --routines --triggers \
     -uroot -p\"${MYSQL_ROOT_PASSWORD}\" ${MYSQL_DATABASE}" \
  | gzip > "${OUT}"

# Hapus backup lebih dari 14 hari
find backups -name "${MYSQL_DATABASE}-*.sql.gz" -type f -mtime +14 -delete

# Hapus log >30 hari
find backups -name "backup.log*" -type f -mtime +30 -delete

echo "[backup] done: ${OUT} ($(du -h "${OUT}" | cut -f1))"
