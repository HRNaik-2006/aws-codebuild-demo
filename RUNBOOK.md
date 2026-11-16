# Runbook: tonight's schedule (region: ap-southeast-2 unless your guide says otherwise)

Everything in the repo is ready. What's left is console work, which only you can do, and the screenshots.
Take a screenshot at every step marked 📸. Only screenshot things you actually created.

## 0. Get the code into GitHub (15 min)
```bash
git clone https://github.com/HRNaik-2006/aws-codebuild-demo
cd aws-codebuild-demo
# unzip supplier-app.zip and copy its contents (customer/, employee/, docker-compose.yml, ...) into this folder
git rm buildspec.yml        # old demo buildspec at repo root; the new ones live in customer/ and employee/
git add . && git commit -m "Split supplier app into customer and employee microservices" && git push
```
📸 GitHub repo showing customer/ and employee/ folders. (Phase 2/3 evidence)

## 1. Phase 1 (30 min)
- Open `Phase1_Architecture.drawio` in https://app.diagrams.net, adjust, File > Export as PNG -> `Phase1_Architecture.png`.
- https://calculator.aws : add Fargate, ALB, RDS MySQL db.t3.micro, ECR, CodeBuild, CodePipeline, CloudWatch, public IPv4. 12-month estimate. Export PDF/link.
- Check your guide for the region the estimate must use. Don't assume.
- CodeCommit is closed to new AWS customers, so the diagram says "CodeCommit / GitHub". If your guide demands CodeCommit and you can't create a repo, GitHub is the substitute; say so in your report.

## 2. Phase 4: Docker test (20 min, in AWS CloudShell or locally)
```bash
docker compose up --build -d
curl localhost:8081/suppliers ; curl localhost:8082/admin
```
📸 `docker ps` showing both containers, plus the browser on each service.
(CloudShell has Docker. If it doesn't work, run it on any laptop with Docker.)

## 3. Phase 5: ECR, ECS cluster, IAM (30 min)
1. ECR > create private repos `customer-microservice` and `employee-microservice`. 📸
2. IAM: make sure role `ecsTaskExecutionRole` exists (ECS > create cluster usually creates it; otherwise create role, use case ECS Task, attach `AmazonECSTaskExecutionRolePolicy`). Add `logs:CreateLogGroup` inline, since the task definitions use `awslogs-create-group`.
3. IAM: role `ecsCodeDeployRole` for CodeDeploy, use case "CodeDeploy - ECS", policy `AWSCodeDeployRoleForECS`.
4. ECS > Create cluster `supplier-cluster`, Fargate only. 📸
5. First image push (needed before services can start). Replace ACCOUNT:
```bash
ACC=$(aws sts get-caller-identity --query Account --output text); R=ap-southeast-2
aws ecr get-login-password --region $R | docker login --username AWS --password-stdin $ACC.dkr.ecr.$R.amazonaws.com
for s in customer employee; do
  docker build -t $ACC.dkr.ecr.$R.amazonaws.com/$s-microservice:latest ./$s
  docker push $ACC.dkr.ecr.$R.amazonaws.com/$s-microservice:latest
done
```
6. ECS > Task definitions > Create > JSON: paste `customer/taskdef.json` with `<ACCOUNT_ID>` replaced and `<IMAGE1_NAME>` replaced by the pushed image URI. Same for employee. 📸

## 4. Phase 6: Load balancer (40 min)
1. EC2 > Security groups: `alb-sg` (inbound 80 and 8080 from anywhere) and `ecs-sg` (inbound 8080 from `alb-sg` only).
2. Target groups, type **IP**, HTTP, port 8080, health check path `/health`. Create four: `customer-blue`, `customer-green`, `employee-blue`, `employee-green`. 📸
3. Application Load Balancer `supplier-alb`, internet-facing, 2 public subnets, `alb-sg`.
   - Listener **:80** (production): default -> `customer-blue`; add rule path `/admin*` -> `employee-blue`.
   - Listener **:8080** (test): default -> `customer-green`; add rule path `/admin*` -> `employee-green`.
   📸 listeners and rules.

Note: with one ALB, both services share the production listener, so CodeDeploy needs each service to point at its own listener rule. When creating the CodeDeploy deployment group, select listener :80 and the matching blue/green target groups per service; ECS blue/green with rule-based routing works if you choose the listener rule in the ECS service's load-balancer config. If this gets fiddly, the fastest fallback is two ALBs (one per service), which costs more but is simpler. Delete them straight after.

## 5. Phase 7: ECS services (30 min)
For each service, ECS > supplier-cluster > Create service:
- Launch type Fargate, task definition from step 3.6, desired tasks 1.
- Deployment type **Blue/green deployment (powered by AWS CodeDeploy)**, role `ecsCodeDeployRole`.
- Network: public subnets, `ecs-sg`, **public IP on** (avoids a NAT Gateway, which is expensive).
- Load balancer: `supplier-alb`, container port 8080, production listener, target group blue, test listener, target group green.
📸 both services Active, tasks Running, then the ALB DNS in the browser showing `/` (customer) and `/admin` (employee).

## 6. Phase 8: CodeBuild + CodePipeline (60 min)
Create **two** pipelines: `customer-pipeline`, `employee-pipeline`.
1. CodeBuild project (per service): GitHub source, **privileged mode ON**, new service role, add `AmazonEC2ContainerRegistryPowerUser` to its role. Buildspec path `customer/buildspec.yml` (or `employee/...`). Env vars: `AWS_ACCOUNT_ID`, `AWS_DEFAULT_REGION=ap-southeast-2`, `ECR_REPO=customer-microservice`.
   - Your old project failed on missing README.md; make new projects rather than reusing that buildspec.
2. CodePipeline: Source = GitHub (via the CodeConnections app), branch main. Build = project above.
3. Deploy stage = **Amazon ECS (Blue/Green)**: CodeDeploy app/deployment group for that service (create under CodeDeploy first: compute platform ECS, role `ecsCodeDeployRole`, choose cluster/service, listeners, target groups; traffic shift all at once, original revision terminated after 5 min).
   - Action settings: AppSpec file `appspec.yaml`, task definition `taskdef.json`, input artifact with image details = the BuildArtifact, placeholder text **`IMAGE1_NAME`**.
📸 pipeline all green (both), CodeDeploy deployment succeeded.

## 7. Phase 9: change and redeploy (30 min)
Edit `customer/server.js`, e.g. change the `<h1>` text; and bump `APP_VERSION` in `customer/taskdef.json` to `v2`. Commit and push.
📸 pipeline running, CodeDeploy traffic shifting, then the browser showing the new page.

## 8. Cleanup (do not skip; ALB, Fargate and RDS bill by the hour)
Delete ECS services (set desired count 0 first), cluster, ALB, target groups, RDS, CodePipelines, CodeBuild projects. Empty and delete the ECR repos. Check Billing > Bills for stragglers.

## RDS (optional, last)
The apps use MySQL when `DB_HOST`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` are set in the task definition's `environment`; otherwise they use built-in sample data. Only add RDS if you have spare time:
create RDS MySQL db.t3.micro (free-tier template), database `suppliers`, security group allowing 3306 from `ecs-sg`, then add those four vars to both task definitions and push. Be upfront in your report about whether the final deployment used RDS or sample data.

## Time budget
Start 18:30 -> sections 0-2 by 19:30, 3-4 by 20:45, 5 by 21:15, 6 by 22:15, 7 by 22:45, 8 + report by 23:15. Pipelines are the riskiest part, so get to step 6 early. If it goes wrong, the ECS services from step 5 still earn most of the screenshots.
