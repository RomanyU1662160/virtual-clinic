variable "aws_account_id" {
  type        = string
  description = "Your personal AWS account id (12 digits)"
}

variable "alert_email" {
  type        = string
  description = "Email address for budget alerts"
}


variable "project_name" {
  type        = string
  description = "Name of the project"
}
