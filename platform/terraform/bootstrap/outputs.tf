output "tfstate_bucket" {
  description = "The name of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.tfstate.id
}

output "tfstate_bucket_arn" {
  description = "The ARN of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.tfstate.arn
}

output "tfstate_bucket_versioning" {
  description = "The versioning status of the S3 bucket for Terraform state"
  value       = aws_s3_bucket_versioning.tfstate.versioning_configuration[0].status
}

