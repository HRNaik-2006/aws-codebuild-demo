# Practical runbook: supplier microservices and CI/CD

Region: `ap-southeast-2`. Use AWS CloudShell for the AWS helper scripts. This repository provides the application, tests, task definitions, CodeBuild buildspecs, AWS helper scripts, and this checklist. Cloud resources are created only when you run the AWS steps; record actual results in [docs/REPORT.md](docs/REPORT.md).

## Linear checklist

### 1. Architecture and estimate

- [ ] Open [Phase1_Architecture.drawio](Phase1_Architecture.drawio) in diagrams.net, review the routing and deployment flow, and export a PNG.
- [ ] In AWS Pricing Calculator, estimate Fargate, ALB, RDS (if used), ECR, CodeBuild, CodePipeline, CloudWatch Logs, and public IPv4 usage for `ap-southeast-2`.
- [ ] Save the estimate and note assumptions, duration, and optional RDS in the report.
- [ ] CodeCommit is closed to new AWS customers, so this practical uses GitHub.

### 2. Source repository

- [ ] Push this repository to the GitHub repository connected to your pipeline. The CodeBuild projects must use the repository root as the source root.
- [ ] Confirm the root `README.md`, `customer/`, `employee/`, `db/`, and `scripts/` are present in GitHub.

### 3. Local application checks

- [ ] Install dependencies and run tests in both service directories:

  ```bash
  cd customer && npm install && npm test && cd ..
  cd employee && npm install && npm test && cd ..
  ```

- [ ] If Docker is available, run `docker compose up --build -d`, check `docker ps`, and visit `http://localhost:8081/suppliers` and `http://localhost:8082/admin`.
- [ ] Smoke-test local Compose using `EMPLOYEE_URL=http://localhost:8082 bash scripts/smoke-test.sh http://localhost:8081`.
- [ ] If Docker is unavailable locally, use AWS CloudShell or another Docker host; record that setup in the report.

### 4. ECR images and ECS task definitions

- [ ] In CloudShell, clone the repository and `cd` to its root. Verify `aws sts get-caller-identity` selects the intended account.
- [ ] Run the helper scripts in the following order. Script 01 creates ECR repositories, builds and pushes both images; script 02 registers both task definitions; script 03 creates networking and the ALB; script 04 creates ECS services; script 05 creates CodeDeploy resources.

  ```bash
  bash scripts/01-ecr-and-images.sh
  bash scripts/02-register-taskdefs.sh
  bash scripts/03-network-and-alb.sh
  bash scripts/04-ecs-cluster-and-services.sh
  bash scripts/05-codedeploy.sh
  ```

- [ ] Record the image URIs, task-definition ARNs, and ALB DNS printed by the scripts.

### 5. CodeBuild projects and pipelines

- [ ] Follow [docs/PIPELINE-CONSOLE-STEPS.md](docs/PIPELINE-CONSOLE-STEPS.md) to create one CodeBuild project and one CodePipeline pipeline per service.
- [ ] Enable CodeBuild privileged mode; use root as source root, but set the buildspec path to `customer/buildspec.yml` or `employee/buildspec.yml`.
- [ ] Set the service-specific environment variables and ECR permissions; connect GitHub with CodeConnections.
- [ ] Use the Amazon ECS (Blue/Green) deploy action, the matching CodeDeploy application/deployment group, `BuildArtifact` as the input artifact for image details, and `IMAGE1_NAME` as the placeholder text.
- [ ] Verify the actual builds/deployments and record only observed results in the report.

### 6. Optional RDS

- [ ] Create RDS MySQL and networking only if it is in scope. Allow inbound 3306 only from `ecs-sg`.
- [ ] Configure the task DB values using [docs/RDS.md](docs/RDS.md); do not store credentials in Git.
- [ ] From a trusted machine with the MySQL client, set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`, then run `bash scripts/init-db.sh`. The apps also create and seed the table at startup if it is empty.
- [ ] If RDS is not configured, report that the services use their in-memory sample records.

### 7. Smoke test

- [ ] Run against the ALB DNS printed by script 03:

  ```bash
  bash scripts/smoke-test.sh http://YOUR-ALB-DNS-NAME
  ```

- [ ] Confirm the directory, admin page, and health check pass. Verify `/admin` through the ALB is served by the employee task.

### 8. Phase 9 visible update

- [ ] Run `bash scripts/phase9-change.sh`; it changes the customer heading and source/task-definition version from v1 to v2.
- [ ] Commit and push using the commands printed by the script. Observe the customer pipeline and verify v2 appears on the customer page.
- [ ] Run customer tests after the change. To restore v1, run `bash scripts/phase9-revert.sh` and commit/push the revert if it should be deployed.

### 9. Report and cleanup

- [ ] Complete [docs/REPORT.md](docs/REPORT.md), replacing every result placeholder with observed information.
- [ ] Capture only evidence for resources and actions that actually occurred. See the checklist below.
- [ ] After screenshots and validation, run `bash scripts/99-cleanup.sh`. It removes CodeDeploy groups/applications, ECS services/cluster, ALB/listeners/target groups, security groups, ECR repositories, and service log groups.
- [ ] Manually delete any RDS instance, CodePipeline pipelines, and CodeBuild projects. Check AWS Billing for remaining resources and usage.

## Screenshot checklist

- [ ] `phase-01-architecture.png` — architecture diagram and cost estimate.
- [ ] `phase-02-github-source.png` — GitHub repository with both service folders and root files.
- [ ] `phase-03-service-pages.png` — customer directory and employee admin pages with visible service/version labels.
- [ ] `phase-04-local-containers.png` — both local containers running and the two pages, if Docker was used.
- [ ] `phase-05-ecr-task-definitions.png` — ECR repositories/images and registered ECS task definitions.
- [ ] `phase-06-alb-routing.png` — ALB listeners, path rules, target groups, and healthy targets.
- [ ] `phase-07-ecs-services.png` — ECS cluster/services and CodeDeploy blue/green configuration.
- [ ] `phase-08-pipelines.png` — both CodeBuild projects and successful pipeline/deployment executions, if completed.
- [ ] `phase-09-v2-release.png` — customer page visibly showing the v2 release after deployment.
- [ ] `phase-cleanup.png` — optional evidence of completed cleanup; do not capture or claim resources that were not created.
