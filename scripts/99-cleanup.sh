#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/config.sh
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

say "Removing CodeDeploy groups and app before their ECS services"
application="$(aws_region deploy list-applications --query "applications[?@=='$CODEDEPLOY_APP'] | [0]" --output text)"
if [[ -n "$application" && "$application" != "None" ]]; then
  for group in "${CUSTOMER_SERVICE}-dg" "${EMPLOYEE_SERVICE}-dg"; do
    groups="$(aws_region deploy list-deployment-groups --application-name "$CODEDEPLOY_APP" --query 'deploymentGroups' --output text | tr '\t' ' ')"
    if [[ " $groups " == *" $group "* ]]; then
      say "Deleting deployment group $group"
      aws_region deploy delete-deployment-group --application-name "$CODEDEPLOY_APP" --deployment-group-name "$group"
    fi
  done
  say "Deleting CodeDeploy application $CODEDEPLOY_APP"
  aws_region deploy delete-application --application-name "$CODEDEPLOY_APP"
fi

cluster_status="$(aws_region ecs describe-clusters --clusters "$CLUSTER_NAME" --query 'clusters[0].status' --output text)"
if [[ "$cluster_status" == "ACTIVE" ]]; then
  for service in "$CUSTOMER_SERVICE" "$EMPLOYEE_SERVICE"; do
    status="$(aws_region ecs describe-services --cluster "$CLUSTER_NAME" --services "$service" --query 'services[0].status' --output text)"
    if [[ "$status" == "ACTIVE" ]]; then
      say "Scaling ECS service $service to zero"
      aws_region ecs update-service --cluster "$CLUSTER_NAME" --service "$service" --desired-count 0 >/dev/null
      aws_region ecs wait services-stable --cluster "$CLUSTER_NAME" --services "$service"
      say "Deleting ECS service $service"
      aws_region ecs delete-service --cluster "$CLUSTER_NAME" --service "$service" --force >/dev/null
      aws_region ecs wait services-inactive --cluster "$CLUSTER_NAME" --services "$service"
    elif [[ "$status" == "DRAINING" ]]; then
      say "Waiting for ECS service $service to finish draining"
      aws_region ecs wait services-inactive --cluster "$CLUSTER_NAME" --services "$service"
    fi
  done
  say "Deleting ECS cluster $CLUSTER_NAME"
  aws_region ecs delete-cluster --cluster "$CLUSTER_NAME" >/dev/null
fi

alb_arn="$(aws_region elbv2 describe-load-balancers --query "LoadBalancers[?LoadBalancerName=='$ALB_NAME'].LoadBalancerArn | [0]" --output text)"
if [[ -n "$alb_arn" && "$alb_arn" != "None" ]]; then
  for listener in $(aws_region elbv2 describe-listeners --load-balancer-arn "$alb_arn" --query 'Listeners[].ListenerArn' --output text); do
    say "Deleting ALB listener $listener"
    aws_region elbv2 delete-listener --listener-arn "$listener"
  done
  say "Deleting ALB $ALB_NAME"
  aws_region elbv2 delete-load-balancer --load-balancer-arn "$alb_arn"
  aws_region elbv2 wait load-balancers-deleted --load-balancer-arns "$alb_arn"
fi

for group in customer-blue customer-green employee-blue employee-green; do
  arn="$(aws_region elbv2 describe-target-groups --query "TargetGroups[?TargetGroupName=='$group'].TargetGroupArn | [0]" --output text)"
  if [[ -n "$arn" && "$arn" != "None" ]]; then
    say "Deleting target group $group"
    aws_region elbv2 delete-target-group --target-group-arn "$arn"
  fi
done

vpc_id="$(aws_region ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
for group_name in "$ECS_SECURITY_GROUP" "$ALB_SECURITY_GROUP"; do
  group_id="$(aws_region ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpc_id" "Name=group-name,Values=$group_name" --query 'SecurityGroups[0].GroupId' --output text)"
  if [[ -n "$group_id" && "$group_id" != "None" ]]; then
    say "Deleting security group $group_name"
    aws_region ec2 delete-security-group --group-id "$group_id"
  fi
done
for repository in "$CUSTOMER_REPO" "$EMPLOYEE_REPO"; do
  repository_arn="$(aws_region ecr describe-repositories --query "repositories[?repositoryName=='$repository'].repositoryArn | [0]" --output text)"
  if [[ -n "$repository_arn" && "$repository_arn" != "None" ]]; then
    say "Deleting ECR repository $repository and its images"
    aws_region ecr delete-repository --repository-name "$repository" --force
  fi
done
for log_group in /ecs/customer-microservice /ecs/employee-microservice; do
  if aws_region logs describe-log-groups --log-group-name-prefix "$log_group" --query "logGroups[?logGroupName=='$log_group'] | length(@)" --output text | grep -q '^1$'; then
    say "Deleting CloudWatch log group $log_group"
    aws_region logs delete-log-group --log-group-name "$log_group"
  fi
done
for role in ecsCodeDeployRole ecsTaskExecutionRole; do
  if aws_region iam get-role --role-name "$role" >/dev/null 2>&1; then
    managed_by="$(aws_region iam list-role-tags --role-name "$role" --query "Tags[?Key=='ManagedBy'].Value | [0]" --output text)"
    if [[ "$managed_by" == "aws-codebuild-demo" ]]; then
      say "Removing policies and IAM role $role"
      if [[ "$role" == "ecsTaskExecutionRole" ]]; then
        aws_region iam delete-role-policy --role-name "$role" --policy-name EcsCreateLogGroups
        aws_region iam detach-role-policy --role-name "$role" --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
      else
        aws_region iam detach-role-policy --role-name "$role" --policy-arn arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS
      fi
      aws_region iam delete-role --role-name "$role"
    else
      say "Leaving pre-existing IAM role $role in place"
    fi
  fi
done
say "Cleanup finished. Check Billing and manually delete RDS, CodePipeline, and CodeBuild projects."
