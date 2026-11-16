#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/config.sh
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

account="$(account_id)"
vpc_id="$(aws_region ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
# shellcheck disable=SC2016
mapfile -t subnets < <(aws_region ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_id" --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId | [0:2]' --output text | tr '\t' '\n')
[[ "${#subnets[@]}" -ge 2 && -n "${subnets[0]}" && -n "${subnets[1]}" ]] || { echo "At least two default public subnets are required in $REGION." >&2; exit 1; }
ecs_sg="$(aws_region ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpc_id" "Name=group-name,Values=$ECS_SECURITY_GROUP" --query 'SecurityGroups[0].GroupId' --output text)"
[[ -n "$ecs_sg" && "$ecs_sg" != "None" ]] || { echo "Run scripts/03-network-and-alb.sh first to create $ECS_SECURITY_GROUP." >&2; exit 1; }

ensure_role() {
  local role="$1" trust_file="$2" policy="$3"
  if aws_region iam get-role --role-name "$role" >/dev/null 2>&1; then
    say "IAM role $role already exists"
  else
    say "Creating IAM role $role"
    aws_region iam create-role --role-name "$role" --assume-role-policy-document "file://$trust_file" --tags Key=ManagedBy,Value=aws-codebuild-demo >/dev/null
  fi
  aws_region iam attach-role-policy --role-name "$role" --policy-arn "$policy"
}

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
cat > "$temp_dir/ecs-trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
cat > "$temp_dir/codedeploy-trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codedeploy.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
ensure_role ecsTaskExecutionRole "$temp_dir/ecs-trust.json" arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
aws_region iam put-role-policy --role-name ecsTaskExecutionRole --policy-name EcsCreateLogGroups --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"logs:CreateLogGroup","Resource":"*"}]}'
ensure_role ecsCodeDeployRole "$temp_dir/codedeploy-trust.json" arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS

for log_group in /ecs/customer-microservice /ecs/employee-microservice; do
  if ! aws_region logs describe-log-groups --log-group-name-prefix "$log_group" --query "logGroups[?logGroupName=='$log_group'] | length(@)" --output text | grep -q '^1$'; then
    say "Creating CloudWatch log group $log_group"
    aws_region logs create-log-group --log-group-name "$log_group"
  fi
done

if aws_region ecs describe-clusters --clusters "$CLUSTER_NAME" --query 'clusters[0].status' --output text | grep -q '^ACTIVE$'; then
  say "ECS cluster $CLUSTER_NAME already exists"
else
  say "Creating Fargate ECS cluster $CLUSTER_NAME"
  aws_region ecs create-cluster --cluster-name "$CLUSTER_NAME" --capacity-providers FARGATE FARGATE_SPOT --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 >/dev/null
fi

ensure_service() {
  local service="$1" family="$2" container="$3" target="$4"
  # shellcheck disable=SC2016
  if aws_region ecs describe-services --cluster "$CLUSTER_NAME" --services "$service" --query 'services[?status==`ACTIVE`] | length(@)' --output text | grep -q '^1$'; then
    say "ECS service $service already exists"
    return
  fi
  if ! aws_region ecs describe-task-definition --task-definition "$family" >/dev/null 2>&1; then
    echo "Task definition $family not found. Run scripts/02-register-taskdefs.sh first." >&2
    return 1
  fi
  say "Creating Fargate service $service with CODE_DEPLOY controller"
  aws_region ecs create-service --cluster "$CLUSTER_NAME" --service-name "$service" --task-definition "$family" --desired-count 1 --launch-type FARGATE --deployment-controller type=CODE_DEPLOY --network-configuration "awsvpcConfiguration={subnets=[${subnets[0]},${subnets[1]}],securityGroups=[$ecs_sg],assignPublicIp=ENABLED}" --load-balancers "targetGroupArn=$target,containerName=$container,containerPort=8080" >/dev/null
}
ensure_service "$CUSTOMER_SERVICE" "$CUSTOMER_FAMILY" customer customer-blue
ensure_service "$EMPLOYEE_SERVICE" "$EMPLOYEE_FAMILY" employee employee-blue
printf 'ECS cluster: %s (account %s)\n' "$CLUSTER_NAME" "$account"
