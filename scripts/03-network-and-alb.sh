#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/config.sh
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

say "Looking up the default VPC and two public subnets"
vpc_id="$(aws_region ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
[[ -n "$vpc_id" && "$vpc_id" != "None" ]] || { echo "No default VPC found in $REGION." >&2; exit 1; }
# shellcheck disable=SC2016
mapfile -t subnets < <(aws_region ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_id" --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId | [0:2]' --output text | tr '\t' '\n')
[[ "${#subnets[@]}" -ge 2 && -n "${subnets[0]}" && -n "${subnets[1]}" ]] || { echo "At least two default public subnets are required in $REGION." >&2; exit 1; }

ensure_group() {
  local name="$1" description="$2" id
  id="$(aws_region ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpc_id" "Name=group-name,Values=$name" --query 'SecurityGroups[0].GroupId' --output text)"
  if [[ -z "$id" || "$id" == "None" ]]; then
    say "Creating security group $name" >&2
    id="$(aws_region ec2 create-security-group --group-name "$name" --description "$description" --vpc-id "$vpc_id" --query GroupId --output text)"
  else
    say "Security group $name already exists" >&2
  fi
  printf '%s' "$id"
}

alb_sg="$(ensure_group "$ALB_SECURITY_GROUP" 'Supplier ALB public HTTP ingress')"
ecs_sg="$(ensure_group "$ECS_SECURITY_GROUP" 'Supplier ECS tasks from the ALB')"
for port in 80 8080; do
  present="$(aws_region ec2 describe-security-groups --group-ids "$alb_sg" --query "SecurityGroups[0].IpPermissions[?IpProtocol=='tcp' && FromPort==\`$port\` && ToPort==\`$port\`].IpRanges[?CidrIp=='0.0.0.0/0'].CidrIp | [0]" --output text)"
  if [[ "$present" == "None" || -z "$present" ]]; then
    say "Allowing public TCP $port on $ALB_SECURITY_GROUP"
    aws_region ec2 authorize-security-group-ingress --group-id "$alb_sg" --ip-permissions "IpProtocol=tcp,FromPort=$port,ToPort=$port,IpRanges=[{CidrIp=0.0.0.0/0,Description='Public HTTP ingress'}]" >/dev/null
  fi
done
present="$(aws_region ec2 describe-security-groups --group-ids "$ecs_sg" --query "SecurityGroups[0].IpPermissions[?IpProtocol=='tcp' && FromPort==\`8080\` && ToPort==\`8080\`].UserIdGroupPairs[?GroupId=='$alb_sg'].GroupId | [0]" --output text)"
if [[ "$present" == "None" || -z "$present" ]]; then
  say "Allowing TCP 8080 from $ALB_SECURITY_GROUP to $ECS_SECURITY_GROUP"
  aws_region ec2 authorize-security-group-ingress --group-id "$ecs_sg" --protocol tcp --port 8080 --source-group "$alb_sg" >/dev/null
fi

ensure_target_group() {
  local name="$1" arn
  arn="$(aws_region elbv2 describe-target-groups --query "TargetGroups[?TargetGroupName=='$name'].TargetGroupArn | [0]" --output text)"
  if [[ -z "$arn" || "$arn" == "None" ]]; then
    say "Creating IP target group $name" >&2
    arn="$(aws_region elbv2 create-target-group --name "$name" --protocol HTTP --port 8080 --target-type ip --vpc-id "$vpc_id" --health-check-path /health --query 'TargetGroups[0].TargetGroupArn' --output text)"
  else
    say "Target group $name already exists" >&2
  fi
  printf '%s' "$arn"
}

customer_blue="$(ensure_target_group customer-blue)"
customer_green="$(ensure_target_group customer-green)"
employee_blue="$(ensure_target_group employee-blue)"
employee_green="$(ensure_target_group employee-green)"

alb_arn="$(aws_region elbv2 describe-load-balancers --query "LoadBalancers[?LoadBalancerName=='$ALB_NAME'].LoadBalancerArn | [0]" --output text)"
if [[ -z "$alb_arn" || "$alb_arn" == "None" ]]; then
  say "Creating internet-facing ALB $ALB_NAME"
  alb_arn="$(aws_region elbv2 create-load-balancer --name "$ALB_NAME" --type application --scheme internet-facing --security-groups "$alb_sg" --subnets "${subnets[0]}" "${subnets[1]}" --query 'LoadBalancers[0].LoadBalancerArn' --output text)"
else
  say "ALB $ALB_NAME already exists"
fi

ensure_listener() {
  local port="$1" target="$2" listener_arn
  listener_arn="$(aws_region elbv2 describe-listeners --load-balancer-arn "$alb_arn" --query "Listeners[?Port==\`$port\`].ListenerArn | [0]" --output text)"
  if [[ -z "$listener_arn" || "$listener_arn" == "None" ]]; then
    say "Creating ALB listener on port $port" >&2
    listener_arn="$(aws_region elbv2 create-listener --load-balancer-arn "$alb_arn" --protocol HTTP --port "$port" --default-actions "Type=forward,TargetGroupArn=$target" --query 'Listeners[0].ListenerArn' --output text)"
  else
    say "Updating default target for listener port $port" >&2
    aws_region elbv2 modify-listener --listener-arn "$listener_arn" --default-actions "Type=forward,TargetGroupArn=$target" >/dev/null
  fi
  printf '%s' "$listener_arn"
}

production_listener="$(ensure_listener 80 "$customer_blue")"
test_listener="$(ensure_listener 8080 "$customer_green")"

# CodeDeploy blue/green uses each service's blue/green target pair and these traffic listeners.
# Shared path rules can be awkward for ECS CodeDeploy; two ALBs (one per service) are the fallback.
ensure_admin_rule() {
  local listener="$1" target="$2" rule
  rule="$(aws_region elbv2 describe-rules --listener-arn "$listener" --query "Rules[?Priority=='10'].RuleArn | [0]" --output text)"
  if [[ -z "$rule" || "$rule" == "None" ]]; then
    say "Adding /admin* routing rule to listener $listener"
    aws_region elbv2 create-rule --listener-arn "$listener" --priority 10 --conditions 'Field=path-pattern,Values=/admin*' --actions "Type=forward,TargetGroupArn=$target" >/dev/null
  else
    say "Updating /admin* routing rule on listener $listener"
    aws_region elbv2 modify-rule --rule-arn "$rule" --conditions 'Field=path-pattern,Values=/admin*' --actions "Type=forward,TargetGroupArn=$target" >/dev/null
  fi
}
ensure_admin_rule "$production_listener" "$employee_blue"
ensure_admin_rule "$test_listener" "$employee_green"

dns="$(aws_region elbv2 describe-load-balancers --load-balancer-arns "$alb_arn" --query 'LoadBalancers[0].DNSName' --output text)"
printf 'ALB DNS: %s\n' "$dns"
