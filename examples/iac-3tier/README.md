# One architecture, written as code — two ways

The same 3-tier web app, written once in **Terraform** and once in **Python (AWS CDK)**.

```
                 Internet
                    |
          [ Application Load Balancer ]      public subnets (AZ a + AZ b)
                    |
     [ EC2 ] [ EC2 ]  ... Auto Scaling 2-4      private app subnets
                    |
     [ RDS PostgreSQL primary ] <-> [ standby ]  isolated DB subnets (Multi-AZ)
```

What gets built (about 45 resources):
- **Network:** a VPC with 6 subnets across 2 AZs, an internet gateway, 1 NAT gateway, and route tables.
- **Security groups:** a chain. The internet can reach only the ALB, the ALB can reach only the web servers, and only the web servers can reach the database.
- **Web servers:** EC2 in an Auto Scaling group behind an ALB, keeping CPU at about 50%. No SSH; you connect with Session Manager. IMDSv2 is required.
- **Database:** RDS PostgreSQL, Multi-AZ and encrypted. RDS generates the password and keeps it in Secrets Manager, so no password appears in any file.
- **Region:** ca-central-1 (Canada Central).

| | Terraform (`terraform/main.tf`) | CDK Python (`cdk-python/app.py`) |
|---|---|---|
| Length | about 370 lines; every resource written out | about 140 lines; `ec2.Vpc(...)` alone builds subnets, routes and NAT |
| What runs it | Terraform talks to AWS APIs directly | CDK turns Python into a CloudFormation template, then CloudFormation builds it |
| Tracks what exists | A state file (`terraform.tfstate`) | The CloudFormation stack |
| Works with other clouds | Yes | AWS only |

`cdk-python/generated-cloudformation-template.json` is the template CDK produced from `app.py`. It's the "one file" form CloudFormation reads directly (about 1,400 lines).

Both files were checked: the Terraform passes `validate`, and the CDK app passes `cdk synth`. Neither has been deployed.

## Running it (optional; this costs money)

The NAT gateway, ALB, EC2 and Multi-AZ RDS are all billed by the hour, so **destroy it as soon as you're done looking.**

Before either option, do this once:
1. Install the AWS CLI.
2. Run `aws configure` with an IAM user or SSO profile in a sandbox account.

**Terraform:**
```
cd terraform
terraform init       # download the AWS provider
terraform plan       # preview the changes; nothing is built yet
terraform apply      # build it (type "yes"); it prints website_url at the end
terraform destroy    # remove everything
```

**CDK (Python):**
```
npm install -g aws-cdk
cd cdk-python
pip install -r requirements.txt
cdk bootstrap        # once per account and Region
cdk synth            # show the CloudFormation template; nothing is built yet
cdk deploy           # build it; it prints WebsiteUrl at the end
cdk destroy          # remove everything
```

Open the website URL after a few minutes. Each refresh shows a different server's hostname, which shows the load balancer is spreading traffic.

## Exam links
- "Repeatable / consistent environments" → CloudFormation, CDK or Terraform.
- "Same setup in every account or Region" → CloudFormation StackSets.
- "Someone changed it by hand" → drift detection (CloudFormation), or `terraform plan` shows the difference.
- "No passwords in code" → Secrets Manager (as the DB does here).
