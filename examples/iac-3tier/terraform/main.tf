###############################################################################
# 3-tier web app on AWS — the whole architecture in ONE Terraform file
#
#   Internet -> ALB (public subnets, 2 AZs)
#            -> Auto Scaling group of EC2 web servers (private subnets)
#            -> RDS PostgreSQL Multi-AZ (isolated DB subnets)
#
# Run:  terraform init  ->  terraform plan  ->  terraform apply
# Remove everything:  terraform destroy
###############################################################################

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# ---------------------------------------------------------------- variables --
variable "region" {
  default = "ca-central-1" # Canada (Central)
}

variable "project" {
  default = "demo-3tier"
}

variable "vpc_cidr" {
  default = "10.0.0.0/16"
}

# Pick the first 2 Availability Zones in the Region
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
  tags = {
    Project   = var.project
    ManagedBy = "terraform"
  }
}

# ------------------------------------------------------------------ network --
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(local.tags, { Name = "${var.project}-vpc" })
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.tags, { Name = "${var.project}-igw" })
}

# 2 public subnets (ALB, NAT gateway): 10.0.0.0/24, 10.0.1.0/24
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true
  tags                    = merge(local.tags, { Name = "${var.project}-public-${count.index + 1}" })
}

# 2 private app subnets (EC2): 10.0.10.0/24, 10.0.11.0/24
resource "aws_subnet" "app" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = local.azs[count.index]
  tags              = merge(local.tags, { Name = "${var.project}-app-${count.index + 1}" })
}

# 2 isolated DB subnets (RDS, no internet route): 10.0.20.0/24, 10.0.21.0/24
resource "aws_subnet" "db" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 20)
  availability_zone = local.azs[count.index]
  tags              = merge(local.tags, { Name = "${var.project}-db-${count.index + 1}" })
}

# One NAT gateway so private servers can download updates.
# (Production: one NAT gateway per AZ, so losing an AZ doesn't cut egress.)
resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = local.tags
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = merge(local.tags, { Name = "${var.project}-nat" })
  depends_on    = [aws_internet_gateway.igw]
}

# Route tables: public -> internet gateway, app -> NAT gateway, db -> local only
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = merge(local.tags, { Name = "${var.project}-public-rt" })
}

resource "aws_route_table" "app" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }
  tags = merge(local.tags, { Name = "${var.project}-app-rt" })
}

resource "aws_route_table" "db" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.tags, { Name = "${var.project}-db-rt" })
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "app" {
  count          = 2
  subnet_id      = aws_subnet.app[count.index].id
  route_table_id = aws_route_table.app.id
}

resource "aws_route_table_association" "db" {
  count          = 2
  subnet_id      = aws_subnet.db[count.index].id
  route_table_id = aws_route_table.db.id
}

# ---------------------------------------------------------- security groups --
# Chain: internet -> ALB (80) -> web servers (80) -> database (5432)
resource "aws_security_group" "alb" {
  name   = "${var.project}-alb-sg"
  vpc_id = aws_vpc.main.id
  ingress {
    description = "HTTP from the internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = local.tags
}

resource "aws_security_group" "app" {
  name   = "${var.project}-app-sg"
  vpc_id = aws_vpc.main.id
  ingress {
    description     = "HTTP only from the ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = local.tags
}

resource "aws_security_group" "db" {
  name   = "${var.project}-db-sg"
  vpc_id = aws_vpc.main.id
  ingress {
    description     = "PostgreSQL only from the web servers"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  tags = local.tags
}

# ------------------------------------------------- IAM role for the servers --
# Lets you open a shell with Session Manager — no SSH keys, no port 22.
resource "aws_iam_role" "web" {
  name = "${var.project}-web-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.web.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "web" {
  name = "${var.project}-web-profile"
  role = aws_iam_role.web.name
}

# ------------------------------------------------------------ web tier (EC2) --
# Latest Amazon Linux 2023 image, looked up from AWS's public SSM parameter
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_launch_template" "web" {
  name_prefix   = "${var.project}-web-"
  image_id      = data.aws_ssm_parameter.al2023.value
  instance_type = "t3.micro"

  iam_instance_profile {
    name = aws_iam_instance_profile.web.name
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  # Require IMDSv2 (security best practice)
  metadata_options {
    http_tokens = "required"
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    dnf install -y httpd
    echo "<h1>Hello from $(hostname -f)</h1>" > /var/www/html/index.html
    systemctl enable --now httpd
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags          = merge(local.tags, { Name = "${var.project}-web" })
  }
}

resource "aws_lb" "web" {
  name               = "${var.project}-alb"
  load_balancer_type = "application"
  internal           = false
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb.id]
  tags               = local.tags
}

resource "aws_lb_target_group" "web" {
  name     = "${var.project}-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
  health_check {
    path    = "/"
    matcher = "200"
  }
  tags = local.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.web.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_autoscaling_group" "web" {
  name                      = "${var.project}-asg"
  min_size                  = 2
  max_size                  = 4
  desired_capacity          = 2
  vpc_zone_identifier       = aws_subnet.app[*].id
  target_group_arns         = [aws_lb_target_group.web.arn]
  health_check_type         = "ELB" # replace servers the ALB marks unhealthy
  health_check_grace_period = 120

  launch_template {
    id      = aws_launch_template.web.id
    version = "$Latest"
  }

  tag {
    key                 = "Project"
    value               = var.project
    propagate_at_launch = true
  }
}

# Keep average CPU around 50% by adding/removing servers
resource "aws_autoscaling_policy" "cpu" {
  name                   = "${var.project}-cpu50"
  autoscaling_group_name = aws_autoscaling_group.web.name
  policy_type            = "TargetTrackingScaling"
  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 50
  }
}

# ---------------------------------------------------------- database (RDS) --
resource "aws_db_subnet_group" "db" {
  name       = "${var.project}-db-subnets"
  subnet_ids = aws_subnet.db[*].id
  tags       = local.tags
}

resource "aws_db_instance" "db" {
  identifier             = "${var.project}-db"
  engine                 = "postgres"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  storage_encrypted      = true
  db_name                = "appdb"
  username               = "appadmin"
  multi_az               = true # standby copy in the second AZ
  db_subnet_group_name   = aws_db_subnet_group.db.name
  vpc_security_group_ids = [aws_security_group.db.id]

  # RDS generates the password and keeps it in Secrets Manager —
  # no password is ever written in this file.
  manage_master_user_password = true

  backup_retention_period = 7
  skip_final_snapshot     = true  # demo only; keep a final snapshot in production
  deletion_protection     = false # demo only; turn on in production
  tags                    = local.tags
}

# ------------------------------------------------------------------ outputs --
output "website_url" {
  value = "http://${aws_lb.web.dns_name}"
}

output "db_endpoint" {
  value = aws_db_instance.db.address
}

output "db_password_secret_arn" {
  value = aws_db_instance.db.master_user_secret[0].secret_arn
}
