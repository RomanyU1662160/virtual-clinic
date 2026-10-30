terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  #   region = "us-east-1" # north virginia
  region = "eu-west-2" # london

  # Safety: Terraform refuses to run against any other AWS account.
  allowed_account_ids = [var.aws_account_id]

  # These tags are added to every resource automatically.
  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
      Stack     = "bootstrap"
    }
  }
}



# ---------- 1. Budget alarm ----------
resource "aws_budgets_budget" "monthly" {
  name         = "vclinic-monthly-budget"
  budget_type  = "COST"
  limit_amount = "10"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Email when real spending reaches 50% of $10 = $5
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  # Email when real spending reaches 80% of $10 = $8
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  # Email when AWS predicts the month will end above $10
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}


# ---------- 2. S3 bucket for Terraform state ----------
# Bucket names must be unique across ALL of AWS, so we add the account id.
resource "aws_s3_bucket" "tfstate" {
  bucket = "vclinic-tfstate-${var.aws_account_id}"



  # Terraform will refuse to delete this bucket, even with `terraform destroy`.
  lifecycle {
    prevent_destroy = true
  }
}

# Keep old versions of every state file, so a broken state can be restored.
resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Encrypt the files at rest (free, AWS-managed key).
resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}


# The state must never be public.
resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
