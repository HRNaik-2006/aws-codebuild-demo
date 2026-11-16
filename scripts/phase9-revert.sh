#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/config.sh
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

server_file="$ROOT_DIR/customer/server.js"
taskdef_file="$ROOT_DIR/customer/taskdef.json"
if grep -Fq "Supplier directory | Phase 9 release" "$server_file" && grep -Fq '"value": "v2"' "$taskdef_file"; then
  sed -i "s@const APP_VERSION = process.env.APP_VERSION || 'v2';@const APP_VERSION = process.env.APP_VERSION || 'v1';@" "$server_file"
  sed -i 's@<h1>Supplier directory | Phase 9 release</h1>@<h1>Supplier directory</h1>@' "$server_file"
  sed -i 's|"name": "APP_VERSION", "value": "v2"|"name": "APP_VERSION", "value": "v1"|' "$taskdef_file"
  say "Reverted Phase 9 customer header and version"
else
  say "Phase 9 change is not fully applied; no files changed"
fi
