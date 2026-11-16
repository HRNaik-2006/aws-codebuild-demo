#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/config.sh
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

account="$(account_id)"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

for service in customer employee; do
  if [[ "$service" == "customer" ]]; then
    family="$CUSTOMER_FAMILY"
    repository="$CUSTOMER_REPO"
  else
    family="$EMPLOYEE_FAMILY"
    repository="$EMPLOYEE_REPO"
  fi
  image="$(ecr_uri "$repository"):latest"
  source_file="$ROOT_DIR/$service/taskdef.json"
  rendered_file="$temp_dir/$service-taskdef.json"
  say "Registering $family with image $image"
  sed -e "s|<ACCOUNT_ID>|$account|g" -e "s|<IMAGE1_NAME>|$image|g" "$source_file" > "$rendered_file"
  arn="$(aws_region ecs register-task-definition --cli-input-json "file://$rendered_file" --query 'taskDefinition.taskDefinitionArn' --output text)"
  printf '%s task definition: %s\n' "$service" "$arn"
done
