# Practical report: Building Microservices and a CI/CD Pipeline with AWS

**Student:** [fill in]  
**Date:** [fill in]  
**AWS Region:** `ap-southeast-2`  
**Repository:** [fill in GitHub URL]  
**Deployment status:** [fill in after deployment; do not infer from local tests]

> Complete each result with evidence from your own account. The repository and this report template do not assert that AWS resources have been created.

## Phase 1 — Architecture and cost estimate

**Objective:** Design the application architecture and estimate the cost of the selected AWS services.

**What was done:** A design for two Node.js supplier microservices, ECS Fargate, an ALB, ECR, CodeBuild, CodePipeline, CodeDeploy, CloudWatch, GitHub, and optional RDS MySQL is represented in `Phase1_Architecture.drawio`. The estimate should use `ap-southeast-2`.

**Key commands/config:** `Phase1_Architecture.drawio`; AWS Pricing Calculator assumptions: [fill in task count, vCPU/memory, runtime hours, ALB hours/LCUs, storage, build minutes, logs, database choice, and public IPv4 hours].

**Expected result:** [fill in after deployment/estimate: exported diagram path, calculator estimate link/file, estimate period, and total].

**Screenshot: [insert phase-01-architecture.png]**

## Phase 2 — Source repository

**Objective:** Store source code and deployment configuration in the GitHub repository used as the pipeline source.

**What was done:** The repository contains separate `customer/` and `employee/` services, root documentation, SQL scripts, and CloudShell helpers. GitHub is used because CodeCommit is closed to new AWS customers.

**Key commands/config:** `git status`; GitHub CodeConnections repository and branch: [fill in].

**Expected result:** [fill in after deployment: repository URL, branch, and commit SHA].

**Screenshot: [insert phase-02-github-source.png]**

## Phase 3 — Microservices implementation

**Objective:** Split supplier browsing and management into separate services with clear APIs and service boundaries.

**What was done:** Customer serves `/`, `/suppliers`, and `/api/suppliers[/:id]`; employee serves `/admin` and `/admin/api/suppliers`. Both use port 8080 and expose `/health`; employee CRUD input is validated.

**Key commands/config:** `cd customer && npm test`; `cd employee && npm test`; `APP_VERSION`; `docker-compose.yml`.

**Expected result:** [fill in observed local or deployed page URLs and service versions].

**Screenshot: [insert phase-03-service-pages.png]**

## Phase 4 — Containerization and local validation

**Objective:** Build and run both services as containers and check their service behavior.

**What was done:** Each service has a Node.js Dockerfile configured to run as the unprivileged `node` user, a service `.dockerignore`, and a Docker Compose mapping to local ports 8081 and 8082.

**Key commands/config:** `docker compose up --build -d`; `EMPLOYEE_URL=http://localhost:8082 bash scripts/smoke-test.sh http://localhost:8081`.

**Expected result:** [fill in after testing: Docker host, container status, smoke checks, or reason Docker was not available].

**Screenshot: [insert phase-04-local-containers.png]**

## Phase 5 — ECR, IAM, and task definitions

**Objective:** Store service images and prepare Fargate task definitions and execution/deployment roles.

**What was done:** The CloudShell helper scripts create the ECR repositories, push images, register task definitions with the required placeholders resolved, and prepare IAM roles.

**Key commands/config:** `bash scripts/01-ecr-and-images.sh`; `bash scripts/02-register-taskdefs.sh`; region `ap-southeast-2`; task CPU/memory `256`/`512`.

**Expected result:** [fill in after deployment: repository/image URIs, task-definition revisions, role ARNs].

**Screenshot: [insert phase-05-ecr-task-definitions.png]**

## Phase 6 — Network and load balancer

**Objective:** Route public requests to the correct service and health-check Fargate targets.

**What was done:** The network helper uses the default VPC and two public subnets, configures ALB/ECS security groups, four IP target groups with `/health`, and listeners on ports 80 and 8080 with `/admin*` routing.

**Key commands/config:** `bash scripts/03-network-and-alb.sh`; ALB `supplier-alb`; security groups `alb-sg` and `ecs-sg`.

**Expected result:** [fill in after deployment: ALB DNS, listener/rule status, and target-group health].

**Screenshot: [insert phase-06-alb-routing.png]**

## Phase 7 — ECS and blue/green deployment

**Objective:** Run the two services on ECS Fargate and prepare CodeDeploy blue/green releases.

**What was done:** The helper scripts create `supplier-cluster`, Fargate services with public IPs, and an ECS CodeDeploy application with per-service deployment groups configured for all-at-once traffic shifting and five-minute termination delay.

**Key commands/config:** `bash scripts/04-ecs-cluster-and-services.sh`; `bash scripts/05-codedeploy.sh`; deployment groups `customer-service-dg` and `employee-service-dg`.

**Expected result:** [fill in after deployment: service status, running tasks, healthy targets, and CodeDeploy status].

**Screenshot: [insert phase-07-ecs-services.png]**

## Phase 8 — CI/CD pipeline

**Objective:** Automate image build/push and ECS blue/green deployment for both services.

**What was done:** Console setup should create two CodeBuild projects and CodePipeline pipelines using GitHub via CodeConnections, service-specific buildspec paths, privileged mode, ECR push permissions, and the ECS blue/green deploy action.

**Key commands/config:** `customer/buildspec.yml`; `employee/buildspec.yml`; `BuildArtifact`; image placeholder `IMAGE1_NAME`; exact console steps in `docs/PIPELINE-CONSOLE-STEPS.md`.

**Expected result:** [fill in after deployment: project/pipeline names, run IDs, build outcome, deployment outcome].

**Screenshot: [insert phase-08-pipelines.png]**

## Phase 9 — Visible change and redeployment

**Objective:** Make a meaningful, visible source change and verify that the pipeline deploys it.

**What was done:** `scripts/phase9-change.sh` changes the customer page heading and `APP_VERSION` from v1 to v2; `scripts/phase9-revert.sh` restores v1.

**Key commands/config:** `bash scripts/phase9-change.sh`; commit and push as printed by the script; `bash scripts/smoke-test.sh http://YOUR-ALB-DNS-NAME`.

**Expected result:** [fill in after deployment: commit, pipeline run, deployed v2 page, and smoke-test results].

**Screenshot: [insert phase-09-v2-release.png]**

## Cost estimate

**Estimate period:** [fill in, e.g. one month / 730 hours]  
**AWS Region:** `ap-southeast-2`  
**Calculator link or exported estimate:** [fill in]

| Cost driver | Assumption | Estimated cost |
| --- | --- | --- |
| ECS Fargate | [fill in desired task count, vCPU, memory, uptime] | [fill in] |
| Application Load Balancer | [fill in uptime and LCU assumption] | [fill in] |
| RDS MySQL, if used | [fill in instance class, storage, uptime] | [fill in] |
| ECR | [fill in image size and retained storage] | [fill in] |
| CodeBuild and CodePipeline | [fill in build minutes and executions] | [fill in] |
| CloudWatch Logs and public IPv4 | [fill in retention, data, and uptime assumptions] | [fill in] |
| **Total** | [include assumptions and exclusions] | **[fill in]** |

Actual charges vary with runtime, region pricing, data transfer, storage, build minutes, and cleanup timing. The ALB, Fargate tasks, RDS, and public IPv4 can continue incurring charges while running.

## Challenges and solutions

- **CodeBuild missing `README.md` failure:** A previous buildspec expected a root README that was not included. This repository has a root `README.md`; configure the new service-specific buildspec paths at repository root.
- **GitHub HTTP 403 due to wrong cached account:** Reconnect the intended GitHub account through AWS CodeConnections and verify it has repository access.
- **CodeCommit closed to new customers:** Use GitHub as the source provider and authorize it with CodeConnections.
- **Docker unavailable locally:** Use AWS CloudShell or another Docker host for image builds and local container checks; record which environment was actually used.
- **Shared ALB and CodeDeploy listener rules:** [fill in actual outcome; if the console or deployment service cannot select the desired per-service routing rules, use two ALBs and document the added cost and configuration].
- **Other challenges:** [fill in only observed problems and their resolution].

## Conclusion

[Summarize what was implemented and actually verified. State whether AWS deployment, pipelines, optional RDS, Phase 9 redeployment, and cleanup were completed. Do not claim unobserved resources or results.]
