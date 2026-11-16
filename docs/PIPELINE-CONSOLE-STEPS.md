# CodeBuild and CodePipeline console settings

Create one CodeBuild project and one CodePipeline pipeline for each microservice. Region: `ap-southeast-2`. Both CodeBuild projects use the **repository root** as their source directory; the service's buildspec path is configured in the project settings.

## CodeBuild project settings

For both services:

1. Create a project using **Source: GitHub via AWS CodeConnections**. Select the connected repository and `main` branch (or the branch you actually use).
2. Select a managed Linux image with Docker support, choose a new or existing CodeBuild service role, and enable **Privileged** in the Environment section. Docker builds fail without privileged mode.
3. Keep the source root at the repository root. Set the buildspec path:
   - Customer project: `customer/buildspec.yml`
   - Employee project: `employee/buildspec.yml`
4. Add environment variables:
   - `AWS_ACCOUNT_ID`: your 12-digit AWS account ID (plain text; not a secret).
   - `AWS_DEFAULT_REGION`: `ap-southeast-2`.
   - `ECR_REPO`: `customer-microservice` or `employee-microservice`, matching the project.
5. Grant the CodeBuild role ECR authorization and image push permissions. The simplest lab policy is the AWS managed `AmazonEC2ContainerRegistryPowerUser` policy. A least-privilege custom policy can scope repository actions to the two ECR repository ARNs and include:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["ecr:GetAuthorizationToken"],
         "Resource": "*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "ecr:BatchCheckLayerAvailability",
           "ecr:CompleteLayerUpload",
           "ecr:InitiateLayerUpload",
           "ecr:PutImage",
           "ecr:UploadLayerPart",
           "ecr:BatchGetImage",
           "ecr:GetDownloadUrlForLayer"
         ],
         "Resource": [
           "arn:aws:ecr:ap-southeast-2:ACCOUNT_ID:repository/customer-microservice",
           "arn:aws:ecr:ap-southeast-2:ACCOUNT_ID:repository/employee-microservice"
         ]
       }
     ]
   }
   ```

6. Verify that each build's output artifact includes `appspec.yaml`, `taskdef.json`, and `imageDetail.json`. The buildspec writes the required image-detail shape `{"ImageURI":"..."}` and leaves `<IMAGE1_NAME>` for the CodeDeploy action.

The CodePipeline service role also needs permission to start/read the selected CodeBuild projects, call the CodeDeploy application/deployment APIs, describe/register ECS task definitions and services, and pass the task execution role to ECS. Keep the wizard-created S3 artifact-bucket permissions. Scope resource permissions to this project's pipelines, CodeBuild projects, CodeDeploy application, task roles, and ECS cluster where AWS supports resource-level authorization.

## CodePipeline settings

Create `customer-pipeline` and `employee-pipeline`, each with these actions:

1. **Source**: GitHub (via CodeConnections), the same repository/branch as the matching project. Set the output artifact name to `SourceArtifact`.
2. **Build**: AWS CodeBuild, choose the matching service project, input artifact `SourceArtifact`, output artifact named exactly `BuildArtifact`.
3. **Deploy**: provider **Amazon ECS (Blue/Green)**. Choose the cluster `supplier-cluster`, service `customer-service` or `employee-service`, and CodeDeploy application `supplier-deploy` with the matching deployment group (`customer-service-dg` or `employee-service-dg`).
4. In the blue/green action configuration, use `appspec.yaml` for the AppSpec file, `taskdef.json` for the task definition, and `BuildArtifact` as the input artifact containing image details. Set the image placeholder text to exactly `IMAGE1_NAME`.
5. Save and run the pipeline. Confirm the CodeBuild artifact contains the expected three files, and inspect the CodeDeploy deployment and target health before reporting success.

## Practical notes

- A previous sample build failed because its buildspec expected a root `README.md`. These projects use the checked-in root README and service-specific buildspecs; configure each buildspec path exactly as listed above.
- GitHub authorization errors (HTTP 403) can result from a browser/console session using a different cached GitHub account. Reconnect the intended account in AWS CodeConnections and confirm that it can read the repository.
- CodeCommit is closed to new AWS customers. This practical uses GitHub and CodeConnections instead.
- CodeDeploy and listener-rule-based blue/green routing can be restrictive when both ECS services share one ALB and listeners. If the console does not permit the desired rule routing for both groups, use separate ALBs as a documented fallback and update the routes, DNS, report, and cleanup accordingly.
- Do not save credentials in CodeBuild environment variables as plain text. The application defaults to in-memory mode, and optional database secrets should follow [RDS.md](RDS.md).
