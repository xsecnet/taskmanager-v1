#!/usr/bin/env bash
# Restore MySQL dari file backup .sql.gz.
# Pemakaian:
#   ./scripts/restore-mysql.sh backups/taskmanager-20260520-020000.sql.gz

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env
set +a

FILE="$1"
[[ -f "$FILE" ]] || { echo "File tidak ditemukan: $FILE"; exit 1; }

echo "[restore] WARNING: ini akan REPLACE database ${MYSQL_DATABASE}"
read -r -p "Lanjut? (yes/N) " yn
[[ "${yn:-}" == "yes" ]] || { echo "Dibatalkan."; exit 1; }

gunzip -c "$FILE" | docker compose exec -T mysql sh -c \
  "exec mysql -uroot -p\"${MYSQL_ROOT_PASSWORD}\" ${MYSQL_DATABASE}"

echo "[restore] selesai dari: $FILE"
