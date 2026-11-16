# Optional RDS MySQL configuration

Both apps use in-memory sample data unless **all** of `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are non-empty. When configured, each service connects with `mysql2`, creates the `suppliers` table if needed, and inserts the eight sample records only when the table is empty. Schema and idempotent seed files are also provided in `db/schema.sql` and `db/seed.sql`.

## Initialize an RDS database

Create a MySQL database named `suppliers` and allow inbound TCP 3306 only from `ecs-sg`. The tasks and database must be in routable subnets/VPC networking. From a trusted shell with the MySQL client, export the connection settings without putting their values in shell history:

```bash
export DB_HOST='your-rds-endpoint'
export DB_USER='your-db-user'
read -rsp 'Database password: ' DB_PASSWORD; echo
export DB_PASSWORD
export DB_NAME='suppliers'
bash scripts/init-db.sh
unset DB_PASSWORD
```

`scripts/init-db.sh` uses the MySQL client, `MYSQL_PWD`, and the repository SQL files. The app also initializes/seeds on startup, so manual initialization is optional.

## Keep credentials out of task-definition source

The committed task definitions contain empty values for `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. Empty values leave the services in in-memory mode. Never commit actual database credentials.

For a deployed task, store the password in AWS Secrets Manager or SSM Parameter Store (SecureString), then remove the `DB_PASSWORD` entry from the task definition's `environment` array and add a `secrets` entry to the container definition. For Secrets Manager:

```json
"secrets": [
  {
    "name": "DB_PASSWORD",
    "valueFrom": "arn:aws:secretsmanager:ap-southeast-2:ACCOUNT_ID:secret:SECRET_NAME"
  }
]
```

For SSM Parameter Store, set `valueFrom` to the parameter ARN, for example `arn:aws:ssm:ap-southeast-2:ACCOUNT_ID:parameter/supplier/DB_PASSWORD`. Grant the **task execution role** permission to retrieve the chosen secret (`secretsmanager:GetSecretValue` or `ssm:GetParameters`); if using a customer-managed KMS key, grant `kms:Decrypt` as well. Keep non-secret connection values in the task definition's environment entries or inject them through a secure deployment configuration. Redeploy after changing the task definition.
