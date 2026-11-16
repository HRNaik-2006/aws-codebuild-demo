#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/config.sh
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 BASE_URL" >&2
  exit 2
fi

base_url="${1%/}"
employee_url="${EMPLOYEE_URL:-$base_url}"
employee_url="${employee_url%/}"
failures=0

check_http() {
  local label="$1" url="$2" status
  if status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$url")" && [[ "$status" == "200" ]]; then
    printf 'PASS %s (%s)\n' "$label" "$url"
  else
    printf 'FAIL %s (%s; HTTP %s)\n' "$label" "$url" "${status:-curl error}"
    failures=$((failures + 1))
  fi
}

check_health() {
  local label="$1" url="$2" body
  if body="$(curl --silent --show-error --fail "$url")" && [[ "$body" == "OK" ]]; then
    printf 'PASS %s (%s)\n' "$label" "$url"
  else
    printf 'FAIL %s (%s; expected HTTP 200 and body OK)\n' "$label" "$url"
    failures=$((failures + 1))
  fi
}

check_health customer-health "$base_url/health"
check_http supplier-directory "$base_url/suppliers"
if [[ "$employee_url" != "$base_url" ]]; then check_health employee-health "$employee_url/health"; fi
check_http employee-admin "$employee_url/admin"

if [[ "$failures" -gt 0 ]]; then
  printf 'Smoke test failed: %s check(s) failed.\n' "$failures" >&2
  exit 1
fi
echo "All smoke tests passed."
