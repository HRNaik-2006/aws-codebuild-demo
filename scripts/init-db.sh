#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/config.sh
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

for variable in DB_HOST DB_USER DB_PASSWORD DB_NAME; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Required environment variable $variable is not set." >&2
    exit 1
  fi
done
command -v mysql >/dev/null || { echo "MySQL client is required." >&2; exit 1; }

export MYSQL_PWD="$DB_PASSWORD"
trap 'unset MYSQL_PWD' EXIT
# shellcheck disable=SC2153
say "Applying supplier schema to $DB_NAME at $DB_HOST"
mysql --protocol=TCP --host="$DB_HOST" --user="$DB_USER" "$DB_NAME" < "$ROOT_DIR/db/schema.sql"
say "Loading seed rows into $DB_NAME"
mysql --protocol=TCP --host="$DB_HOST" --user="$DB_USER" "$DB_NAME" < "$ROOT_DIR/db/seed.sql"
say "Database initialization complete"
