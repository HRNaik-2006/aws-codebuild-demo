#!/usr/bin/env bash
set -euo pipefail

REGION="ap-southeast-2"
# shellcheck disable=SC2034
CLUSTER_NAME="supplier-cluster"
# shellcheck disable=SC2034
ALB_NAME="supplier-alb"
# shellcheck disable=SC2034
CUSTOMER_REPO="customer-microservice"
# shellcheck disable=SC2034
EMPLOYEE_REPO="employee-microservice"
# shellcheck disable=SC2034
CUSTOMER_SERVICE="customer-service"
# shellcheck disable=SC2034
EMPLOYEE_SERVICE="employee-service"
# shellcheck disable=SC2034
CUSTOMER_FAMILY="customer-microservice"
# shellcheck disable=SC2034
EMPLOYEE_FAMILY="employee-microservice"
# shellcheck disable=SC2034
ALB_SECURITY_GROUP="alb-sg"
# shellcheck disable=SC2034
ECS_SECURITY_GROUP="ecs-sg"
# shellcheck disable=SC2034
CODEDEPLOY_APP="supplier-deploy"
# shellcheck disable=SC2034
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

aws_region() {
  aws --region "$REGION" "$@"
}

account_id() {
  aws_region sts get-caller-identity --query Account --output text
}

ecr_uri() {
  printf '%s.dkr.ecr.%s.amazonaws.com/%s' "$(account_id)" "$REGION" "$1"
}

resource_id() {
  aws_region "$@"
}
