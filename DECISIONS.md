# Decisions and assumptions

## Application behavior and security

- Preserved the two existing Express services, ports, customer and employee route prefixes, health endpoint contract, service/container names, deployment placeholders, and CodeBuild artifact names/shapes.
- MySQL is selected only when `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are all non-empty. Otherwise each process uses its own in-memory eight-row sample list. This prevents a partially configured task definition from accidentally trying to connect to a database.
- Used `mysql2` parameterized queries for all dynamic SQL values and added strict positive-integer checks to employee mutation IDs. HTML content and form attribute values are escaped.
- Employee add and update require a non-blank name and syntactically valid email, with existing database-compatible field limits. Invalid API requests return structured HTTP 400 errors; invalid forms return HTTP 400 with a friendly message and retain entered values.
- A delete of a missing employee supplier returns 404; invalid IDs return 400. These statuses make API behavior explicit rather than silently reporting success.
- Both services initialize a missing MySQL schema and seed eight sample records only when the table is empty. A named MySQL lock prevents two services starting together from seeding the same empty database twice. The SQL seed script is separately repeatable and inserts missing example emails without overwriting existing supplier rows.
- Used inline CSS rather than CDN assets to keep pages self-contained. Service name and APP_VERSION are visible on all rendered pages. Customer directory count is included as a baseline for Phase 9 demos.
- Added one-line JSON request, startup, error, and shutdown logs without request bodies, credentials, or query strings.
- SIGTERM/SIGINT stops accepting new requests, closes the MySQL pool, and exits with an explicit success/failure status.
- Kept Express and mysql2 at the existing declared ranges; Node's built-in `node:test` and `fetch` avoid additional test dependencies.

## Containers, database, and deployment

- Dockerfiles retain Node 20 Alpine and use the built-in non-root `node` account. `.dockerignore` excludes local packages, env files, archives, and Git metadata.
- Empty DB environment values in task definitions preserve a database-free default. The documentation explains replacing only the password environment entry with a Secrets Manager or SSM `secrets` reference and granting task-execution-role access.
- The database schema requires name/email and defaults the remaining text fields to empty strings. The eight illustrative addresses use reserved `.example` email domains rather than real supplier contacts.
- Shared resource names, region, account helpers, and root discovery are centralized in `scripts/config.sh`. The AWS scripts use the current CLI identity and do not embed account identifiers or credentials.
- AWS scripts are designed to be repeatable by looking up existing resources before creation and skipping missing resources during teardown. They are intended for CloudShell, use the default VPC and two auto-assign-public-IP subnets, and require permissions to manage the specified AWS resources.
- The cleanup helper deletes the two IAM roles only when they were created and tagged by this project; it leaves pre-existing roles intact.
- The ALB design uses listeners on 80 and 8080, with `/admin*` listener rules and separate customer/employee blue/green target groups, matching the assignment. CodeDeploy rule-level routing with both services sharing the same ALB listeners may require separate ALBs if the AWS console/API cannot associate each deployment group with the intended rule.
- The AWS scripts create service log groups, task execution and CodeDeploy roles, ECS services, and deployment groups, but do not create an RDS instance or CodeBuild/CodePipeline projects. Those are optional/manual tasks described in the runbook.
- Cleanup deletes CodeDeploy groups/application before ECS services so the deployment groups do not remain attached to deleted services; it then removes the cluster/network/image resources and log groups. It intentionally leaves IAM roles and any RDS, CodeBuild, or CodePipeline resources for manual review.
- `scripts/smoke-test.sh` uses the customer URL as its one required base URL and supports an optional `EMPLOYEE_URL` for the separate local Compose ports; a single ALB URL needs no override.
- Phase 9 updates only the customer heading and its fallback/task-definition APP_VERSION from v1 to v2, so the change is visually clear and reversible without altering service contracts or employee versioning.
- The report is a template and does not state that cloud resources exist. Actual costs and deployment outcomes must be filled in after account-specific measurement.
