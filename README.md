# Supplier management microservices on AWS

This practical demonstrates a small supplier-management application split into two Node.js/Express services, packaged as containers, and deployed to Amazon ECS on Fargate. CodePipeline and CodeBuild build each service, Amazon ECR stores images, and CodeDeploy provides blue/green deployments behind an Application Load Balancer (ALB).

The default app uses eight in-memory supplier records and starts without AWS credentials or a database. When all four `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` settings are provided, it uses MySQL via `mysql2`. Containers listen on port 8080, and both expose `GET /health` returning `OK`.

## Architecture

```text
GitHub -> CodePipeline -> CodeBuild -> ECR -> CodeDeploy (ECS blue/green)
                                             -> ECS Fargate services
Users -> ALB :80 and :8080 -> customer / employee path routing
                              -> optional RDS MySQL
```

The ALB routes `/` and `/suppliers` to the customer service and `/admin*` to the employee service. The customer service is read-only; the employee service provides supplier create, update, and delete operations. For the one-ALB CodeDeploy listener-rule caveat and the two-ALB alternative, see [scripts/03-network-and-alb.sh](scripts/03-network-and-alb.sh).

## Endpoints

| Service | Path | Purpose |
| --- | --- | --- |
| Both | `GET /health` | Container/target-group health check; returns `200 OK` |
| Customer | `GET /`, `GET /suppliers` | Supplier directory |
| Customer | `GET /api/suppliers`, `GET /api/suppliers/:id` | Read-only JSON API |
| Employee | `GET /admin` | Supplier admin UI |
| Employee | `GET /admin/api/suppliers` | List suppliers |
| Employee | `POST /admin/api/suppliers` | Add supplier; requires name and valid email |
| Employee | `PUT /admin/api/suppliers/:id` | Update supplier; requires name and valid email |
| Employee | `DELETE /admin/api/suppliers/:id` | Delete supplier |

The employee service also supports form-based add/edit/delete actions under `/admin`. Input is validated server-side; HTML output is escaped.

## Run locally

Requires Node.js 20+ and npm:

```bash
cd customer
npm install
npm test
npm start
```

In another terminal:

```bash
cd employee
npm install
npm test
npm start
```

To run both services on their published local ports, use Docker Compose from the repository root:

```bash
docker compose up --build
```

Then visit `http://localhost:8081/suppliers` and `http://localhost:8082/admin`. Smoke-test the separate local origins with:

```bash
EMPLOYEE_URL=http://localhost:8082 bash scripts/smoke-test.sh http://localhost:8081
```

Against the ALB DNS name, one base URL is sufficient:

```bash
bash scripts/smoke-test.sh http://SUPPLIER-ALB-DNS-NAME
```

## Repository layout

```text
customer/             Read-only service, Dockerfile, task definition, CodeBuild spec, tests
employee/             Admin service, Dockerfile, task definition, CodeBuild spec, tests
db/                   MySQL schema and idempotent sample seed
scripts/              AWS CloudShell provisioning, database, smoke, and Phase 9 scripts
docs/                 RDS guidance, console pipeline setup, and practical report template
docker-compose.yml    Local two-service setup (ports 8081 and 8082)
Phase1_Architecture.drawio
RUNBOOK.md            Linear practical checklist and screenshot checklist
```

## Deployment order

Use AWS CloudShell in `ap-southeast-2`, with AWS CLI credentials authorized for the listed resources. First push the committed repository to GitHub and configure the GitHub connection in CodePipeline. Then run the helper scripts in this order:

```bash
bash scripts/01-ecr-and-images.sh
bash scripts/02-register-taskdefs.sh
bash scripts/03-network-and-alb.sh
bash scripts/04-ecs-cluster-and-services.sh
bash scripts/05-codedeploy.sh
```

Afterward create CodeBuild projects and CodePipeline pipelines in the AWS console using [docs/PIPELINE-CONSOLE-STEPS.md](docs/PIPELINE-CONSOLE-STEPS.md). Apply the database schema and seed only if using RDS: configure the four DB variables and run `bash scripts/init-db.sh`. For deployment details and teardown, follow [RUNBOOK.md](RUNBOOK.md). Run `bash scripts/99-cleanup.sh` when finished; manually remove RDS, CodePipeline, and CodeBuild resources and check Billing.

## Phase 9 demonstration

Run `bash scripts/phase9-change.sh` to bump the customer page to v2 and change its heading, then follow the printed Git commands and rerun the customer pipeline. Use `bash scripts/phase9-revert.sh` to return the source to v1.

## Security and deployment notes

- Both Docker images run as the unprivileged `node` user. `.dockerignore` excludes local dependencies, environment files, and archives.
- Secrets are not included in source or task definitions. DB environment fields default to empty; see [docs/RDS.md](docs/RDS.md) to use Secrets Manager or SSM Parameter Store.
- Task definitions keep the CodeDeploy-required `<TASK_DEFINITION>` and `<IMAGE1_NAME>` placeholders in their respective deployment files.
- The scripts create resources in the AWS account selected by the CloudShell CLI identity. Review the scripts before running and use the cleanup helper plus a Billing check afterward.
