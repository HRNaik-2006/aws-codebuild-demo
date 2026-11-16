#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/config.sh
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

server_file="$ROOT_DIR/customer/server.js"
taskdef_file="$ROOT_DIR/customer/taskdef.json"
if grep -Fq "const APP_VERSION = process.env.APP_VERSION || 'v2';" "$server_file" &&
  grep -Fq "Supplier directory | Phase 9 release" "$server_file" &&
  grep -Fq '"value": "v2"' "$taskdef_file"; then
  say "Phase 9 customer change is already applied"
else
  grep -Fq "const APP_VERSION = process.env.APP_VERSION || 'v1';" "$server_file" || { echo "Unexpected customer server version; refusing to overwrite." >&2; exit 1; }
  grep -Fq '<h1>Supplier directory</h1>' "$server_file" || { echo "Unexpected customer page heading; refusing to overwrite." >&2; exit 1; }
  grep -Fq '"name": "APP_VERSION", "value": "v1"' "$taskdef_file" || { echo "Unexpected customer task definition version; refusing to overwrite." >&2; exit 1; }
  sed -i "s@const APP_VERSION = process.env.APP_VERSION || 'v1';@const APP_VERSION = process.env.APP_VERSION || 'v2';@" "$server_file"
  sed -i 's@<h1>Supplier directory</h1>@<h1>Supplier directory | Phase 9 release</h1>@' "$server_file"
  sed -i 's|"name": "APP_VERSION", "value": "v1"|"name": "APP_VERSION", "value": "v2"|' "$taskdef_file"
  say "Updated customer service header and version to v2"
fi
printf '\nCommit and push these changes with:\n'
printf '  git add customer/server.js customer/taskdef.json\n'
printf '  git commit -m "Demonstrate Phase 9 customer release"\n'
printf '  git push\n'
