#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/config.sh
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

account="$(account_id)"
role_arn="arn:aws:iam::${account}:role/ecsCodeDeployRole"
cluster_arn="$(aws_region ecs describe-clusters --clusters "$CLUSTER_NAME" --query 'clusters[0].clusterArn' --output text)"
[[ -n "$cluster_arn" && "$cluster_arn" != "None" ]] || { echo "ECS cluster $CLUSTER_NAME not found. Run scripts/04-ecs-cluster-and-services.sh first." >&2; exit 1; }
alb_arn="$(aws_region elbv2 describe-load-balancers --query "LoadBalancers[?LoadBalancerName=='$ALB_NAME'].LoadBalancerArn | [0]" --output text)"
[[ -n "$alb_arn" && "$alb_arn" != "None" ]] || { echo "ALB $ALB_NAME not found. Run scripts/03-network-and-alb.sh first." >&2; exit 1; }
# shellcheck disable=SC2016
prod_listener="$(aws_region elbv2 describe-listeners --load-balancer-arn "$alb_arn" --query 'Listeners[?Port==`80`].ListenerArn | [0]' --output text)"
# shellcheck disable=SC2016
test_listener="$(aws_region elbv2 describe-listeners --load-balancer-arn "$alb_arn" --query 'Listeners[?Port==`8080`].ListenerArn | [0]' --output text)"
[[ -n "$prod_listener" && "$prod_listener" != "None" && -n "$test_listener" && "$test_listener" != "None" ]] || { echo "Required ALB listeners on ports 80 and 8080 were not found." >&2; exit 1; }

if ! aws_region deploy get-application --application-name "$CODEDEPLOY_APP" >/dev/null 2>&1; then
  say "Creating CodeDeploy ECS application $CODEDEPLOY_APP"
  aws_region deploy create-application --application-name "$CODEDEPLOY_APP" --compute-platform ECS >/dev/null
else
  say "CodeDeploy application $CODEDEPLOY_APP already exists"
fi

ensure_deployment_group() {
  local service="$1" blue="$2" green="$3" group="${1}-dg"
  if aws_region deploy get-deployment-group --application-name "$CODEDEPLOY_APP" --deployment-group-name "$group" >/dev/null 2>&1; then
    say "Deployment group $group already exists"
    return
  fi
  say "Creating deployment group $group with all-at-once traffic shifting"
  aws_region deploy create-deployment-group \
    --application-name "$CODEDEPLOY_APP" \
    --deployment-group-name "$group" \
    --service-role-arn "$role_arn" \
    --deployment-config-name CodeDeployDefault.ECSAllAtOnce \
    --deployment-style deploymentType=BLUE_GREEN,deploymentOption=WITH_TRAFFIC_CONTROL \
    --blue-green-deployment-configuration '{"deploymentReadyOption":{"actionOnTimeout":"CONTINUE_DEPLOYMENT","waitTimeInMinutes":0},"terminateBlueInstancesOnDeploymentSuccess":{"action":"TERMINATE","terminationWaitTimeInMinutes":5},"deploymentApprovalWaitTimeInMinutes":0}' \
    --load-balancer-info "{\"targetGroupPairInfoList\":[{\"targetGroups\":[{\"name\":\"$blue\"},{\"name\":\"$green\"}],\"prodTrafficRoute\":{\"listenerArns\":[\"$prod_listener\"]},\"testTrafficRoute\":{\"listenerArns\":[\"$test_listener\"]}}]}" \
    --ecs-services "serviceName=$service,clusterName=$CLUSTER_NAME" >/dev/null
}

ensure_deployment_group "$CUSTOMER_SERVICE" customer-blue customer-green
ensure_deployment_group "$EMPLOYEE_SERVICE" employee-blue employee-green
printf 'CodeDeploy application: %s\nCustomer deployment group: %s-dg\nEmployee deployment group: %s-dg\n' "$CODEDEPLOY_APP" "$CUSTOMER_SERVICE" "$EMPLOYEE_SERVICE"
