#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/config.sh
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

command -v docker >/dev/null || { echo "Docker CLI is required (AWS CloudShell provides it)." >&2; exit 1; }
account="$(account_id)"
registry="${account}.dkr.ecr.${REGION}.amazonaws.com"

for repository in "$CUSTOMER_REPO" "$EMPLOYEE_REPO"; do
  if aws_region ecr describe-repositories --repository-names "$repository" >/dev/null 2>&1; then
    say "ECR repository $repository already exists"
  else
    say "Creating ECR repository $repository"
    aws_region ecr create-repository --repository-name "$repository" >/dev/null
  fi
done

say "Logging Docker in to ECR in $REGION"
aws_region ecr get-login-password | docker login --username AWS --password-stdin "$registry"

for service in customer employee; do
  if [[ "$service" == "customer" ]]; then repository="$CUSTOMER_REPO"; else repository="$EMPLOYEE_REPO"; fi
  image="${registry}/${repository}:latest"
  say "Building and pushing $image from $service/"
  docker build -t "$image" "$ROOT_DIR/$service"
  docker push "$image"
  printf '%s image: %s\n' "$service" "$image"
done
