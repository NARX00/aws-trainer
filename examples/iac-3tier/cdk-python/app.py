#!/usr/bin/env python3
"""
3-tier web app on AWS — the same architecture as ../terraform/main.tf,
written in Python with the AWS CDK.

  Internet -> ALB (public subnets, 2 AZs)
           -> Auto Scaling group of EC2 web servers (private subnets)
           -> RDS PostgreSQL Multi-AZ (isolated DB subnets)

CDK turns this Python into a CloudFormation template, then deploys it.
Run:  cdk synth   (see the generated template)
      cdk deploy  (build it)
      cdk destroy (remove everything)
"""
from aws_cdk import (
    App, Stack, Environment, CfnOutput, Duration, RemovalPolicy, Tags,
    aws_ec2 as ec2,
    aws_elasticloadbalancingv2 as elbv2,
    aws_autoscaling as autoscaling,
    aws_rds as rds,
    aws_iam as iam,
)
from constructs import Construct


class ThreeTierStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ---------------------------------------------------------- network --
        # One line builds: VPC, 6 subnets in 2 AZs, internet gateway,
        # NAT gateway, and all route tables.
        vpc = ec2.Vpc(
            self, "Vpc",
            ip_addresses=ec2.IpAddresses.cidr("10.0.0.0/16"),
            max_azs=2,
            nat_gateways=1,  # production: one per AZ
            subnet_configuration=[
                ec2.SubnetConfiguration(name="public", cidr_mask=24,
                                        subnet_type=ec2.SubnetType.PUBLIC),
                ec2.SubnetConfiguration(name="app", cidr_mask=24,
                                        subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
                ec2.SubnetConfiguration(name="db", cidr_mask=24,
                                        subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            ],
        )

        # -------------------------------------------------- security groups --
        alb_sg = ec2.SecurityGroup(self, "AlbSg", vpc=vpc,
                                   description="HTTP from the internet")
        alb_sg.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(80))

        app_sg = ec2.SecurityGroup(self, "AppSg", vpc=vpc,
                                   description="HTTP only from the ALB")
        app_sg.add_ingress_rule(alb_sg, ec2.Port.tcp(80))

        db_sg = ec2.SecurityGroup(self, "DbSg", vpc=vpc, allow_all_outbound=False,
                                  description="PostgreSQL only from web servers")
        db_sg.add_ingress_rule(app_sg, ec2.Port.tcp(5432))

        # ------------------------------------------ IAM role for the servers --
        # Session Manager access instead of SSH keys / port 22
        role = iam.Role(
            self, "WebRole",
            assumed_by=iam.ServicePrincipal("ec2.amazonaws.com"),
            managed_policies=[iam.ManagedPolicy.from_aws_managed_policy_name(
                "AmazonSSMManagedInstanceCore")],
        )

        # ----------------------------------------------------- web tier (EC2) --
        user_data = ec2.UserData.for_linux()
        user_data.add_commands(
            "dnf install -y httpd",
            'echo "<h1>Hello from $(hostname -f)</h1>" > /var/www/html/index.html',
            "systemctl enable --now httpd",
        )

        launch_template = ec2.LaunchTemplate(
            self, "WebLaunchTemplate",
            instance_type=ec2.InstanceType("t3.micro"),
            machine_image=ec2.MachineImage.latest_amazon_linux2023(),
            security_group=app_sg,
            role=role,
            user_data=user_data,
            require_imdsv2=True,
        )

        asg = autoscaling.AutoScalingGroup(
            self, "WebAsg",
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            launch_template=launch_template,
            min_capacity=2,
            max_capacity=4,
            health_checks=autoscaling.HealthChecks.with_additional_checks(
                additional_types=[autoscaling.AdditionalHealthCheckType.ELB],
                grace_period=Duration.minutes(2),
            ),
        )
        asg.scale_on_cpu_utilization("Cpu50", target_utilization_percent=50)

        alb = elbv2.ApplicationLoadBalancer(
            self, "Alb", vpc=vpc, internet_facing=True, security_group=alb_sg,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),
        )
        listener = alb.add_listener("Http", port=80, open=False)
        listener.add_targets(
            "Web", port=80, targets=[asg],
            health_check=elbv2.HealthCheck(path="/", healthy_http_codes="200"),
        )

        # -------------------------------------------------- database (RDS) --
        db = rds.DatabaseInstance(
            self, "Db",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_16),
            instance_type=ec2.InstanceType("t3.micro"),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[db_sg],
            multi_az=True,                       # standby copy in the second AZ
            allocated_storage=20,
            storage_encrypted=True,
            database_name="appdb",
            # Password generated and stored in Secrets Manager — never in code
            credentials=rds.Credentials.from_generated_secret("appadmin"),
            backup_retention=Duration.days(7),
            removal_policy=RemovalPolicy.DESTROY,  # demo only
            deletion_protection=False,             # demo only
        )

        # ------------------------------------------------------------ outputs --
        CfnOutput(self, "WebsiteUrl", value=f"http://{alb.load_balancer_dns_name}")
        CfnOutput(self, "DbEndpoint", value=db.db_instance_endpoint_address)
        CfnOutput(self, "DbSecretArn", value=db.secret.secret_arn)


app = App()
stack = ThreeTierStack(app, "Demo3Tier",
                       env=Environment(region="ca-central-1"))  # Canada (Central)
Tags.of(stack).add("Project", "demo-3tier")
Tags.of(stack).add("ManagedBy", "cdk")
app.synth()
