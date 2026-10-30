# 03 — Infrastructure Plan

> Status: Draft v1 · 2026-10-30
>
> This document explains, in simple steps, how we will create our AWS resources and deploy our code.

## 1. What "infrastructure" means in this project

Our code (the Lambda functions) needs places to run, store data and send messages. These places are AWS
services. Together they are our **infrastructure**.

| AWS service                 | What it does for us, in one sentence                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| **Lambda**                  | Runs our TypeScript code when something happens (an HTTP request or a message).                |
| **API Gateway (HTTP API)**  | Gives us a public URL, e.g. `POST /appointments`, and calls the right Lambda.                  |
| **DynamoDB**                | Stores our data (members, appointments, …). Each service has its own tables.                   |
| **EventBridge (event bus)** | Receives events like "appointment booked" and sends a copy to every service that wants it.     |
| **SQS (queue)**             | Holds events for a Lambda until the Lambda is ready, and retries if the Lambda fails.          |
| **DLQ (dead-letter queue)** | A normal SQS queue where failed messages go after several retries, so nothing is lost.         |
| **EventBridge Scheduler**   | Triggers something at an exact time, e.g. "send the reminder 24 hours before the appointment". |
| **SSM Parameter Store**     | A free key/value store for settings, e.g. the name of the event bus.                           |
| **CloudWatch**              | Keeps our logs and raises alarms.                                                              |
| **IAM**                     | Permissions: says exactly what each Lambda is allowed to do.                                   |
| **S3**                      | Stores Terraform's "state" file (explained in section 4).                                      |
| **AWS Budgets**             | Emails us if the monthly bill goes over $5 or $8.                                              |

## 2. What Terraform is

Terraform is a tool that creates AWS resources **from code files** (`.tf` files) instead of clicking in the AWS
console.

Example: this code creates one SQS queue.

```hcl
resource "aws_sqs_queue" "audit_events" {
  name = "vclinic-dev-audit-events"
}
```

The two main commands:

- `terraform plan` shows what **would** change. Nothing is created yet. Always read it first.
- `terraform apply` makes the change in AWS.

Why use code instead of clicking: the code is saved in Git, it can be reviewed in a pull request, and we can
create the same setup again for another environment with one command.

## 3. Environments

An **environment** is one complete, separate copy of the whole system.

| Environment | Who uses it                     | Purpose                                  |
| ----------- | ------------------------------- | ---------------------------------------- |
| `dev`       | Developers                      | Try new code. It is fine if it breaks.   |
| `tst`       | Testers / checks before release | A stable copy for testing finished work. |
| `prod`      | Real users                      | Not built in this project yet.           |

How we keep them separate:

- **Same Terraform code** for every environment. Only a small settings file is different: `dev.tfvars` and
  `tst.tfvars`.
- **Every resource name starts with the project and the environment**, so the copies never mix:
  `vclinic-dev-booking-appointments` and `vclinic-tst-booking-appointments` are two different tables.
- Both environments live in **one AWS account** (your personal account). Big companies use one account per
  environment; we use one account to keep it simple and cheap.

Example of a settings file:

```hcl
# dev.tfvars
env                = "dev"
log_retention_days = 7
```

## 4. Terraform "state", in simple words

Terraform keeps a file called the **state**. It is a list of everything Terraform has created, e.g. "I created a
queue called `vclinic-dev-audit-events`, and its AWS id is …".

Terraform needs this file to know what already exists, so the next `apply` only changes what is different.

- We store the state file in an **S3 bucket**, not on your laptop. If it was only on your laptop and the laptop
  broke, Terraform would forget everything it created.
- Terraform **locks** the state while it is working, so two people cannot run `apply` at the same time and
  break it. Terraform 1.10 and newer can do this lock with a small file in the same S3 bucket.
- **Each part of the system has its own state file**, e.g. one for shared things and one per service per
  environment. Then a mistake in one part cannot damage another part.

```
s3://vclinic-tfstate-<account-id>/
├── shared/dev.tfstate
├── shared/tst.tfstate
├── booking/dev.tfstate
└── booking/tst.tfstate
```

## 5. Folder layout

```
virtual-clinic/
├── platform/terraform/
│   ├── bootstrap/        # Created ONCE, by hand: the S3 state bucket and the budget alarm
│   ├── modules/          # Reusable building blocks (like functions, but for infrastructure)
│   │   ├── lambda-fn/        # one Lambda + its IAM role + its log group
│   │   ├── sqs-consumer/     # one queue + its DLQ + the rule that connects it to the event bus
│   │   └── dynamodb-table/   # one DynamoDB table with our standard settings
│   └── shared/           # Things every service uses: the event bus and the HTTP API
│       ├── main.tf
│       ├── dev.tfvars
│       └── tst.tfvars
└── services/booking/
    ├── src/functions/book-appointment/
    │   ├── lambda.ts        # Middy + Powertools setup
    │   ├── app.ts           # the business logic
    │   └── function.tf      # this Lambda's permissions and trigger (uses modules/lambda-fn)
    └── infra/
        ├── main.tf          # the Booking table + one block per Lambda
        ├── dev.tfvars
        └── tst.tfvars
```

What each layer is for:

- **bootstrap**: the S3 bucket must exist **before** Terraform can save state into it. So we create it once, by
  itself, and never touch it again.
- **modules**: we write "how to make a Lambda" once. Every service then uses it in a few lines, so all our
  Lambdas get the same safe settings (log retention, tracing, least-privilege permissions).
- **shared**: the event bus and the HTTP API are used by every service, so they live in one place. They save
  their names into SSM Parameter Store, e.g. `/vclinic/dev/event-bus-name`. Services read the names from there.
- **services/\*/infra**: each service owns its own tables, Lambdas and queues. Changing Booking never touches
  Membership.

## 6. The order we will build things

Each step is small and you run it yourself.

| Step | What we build                                                                    | Costs money?   |
| ---- | -------------------------------------------------------------------------------- | -------------- |
| 1    | Learn Terraform locally: a tiny example with no AWS (the `local_file` resource). | No             |
| 2    | `bootstrap`: the S3 state bucket and the budget alarm.                           | No (free tier) |
| 3    | `modules/lambda-fn` and a "hello" Lambda deployed to `dev`, then destroyed.      | No             |
| 4    | `shared` for `dev`: the event bus and the HTTP API.                              | No             |
| 5    | The first real flow, for `dev` (see section 7).                                  | No             |
| 6    | The same thing for `tst`, using `tst.tfvars`.                                    | No             |

"Free" here means: inside the AWS free tier at our small usage. The budget alarm from step 2 warns us before
anything costs real money.

## 7. The first real flow (what step 5 builds)

A member books an appointment, and Audit records it:

```
Member
  │  POST /appointments
  ▼
API Gateway ──► Lambda "book-appointment"  (services/booking)
                  │ 1. save the appointment in DynamoDB (fails if the slot is already taken)
                  │ 2. publish the event "booking.appointment.booked"
                  ▼
             EventBridge event bus
                  │ a rule: "send booking.* events to the audit queue"
                  ▼
             SQS queue ──(after 3 failures)──► DLQ
                  ▼
             Lambda "record-event"  (services/audit)
                  │ 3. check the event is valid, then save it in the audit DynamoDB table
```

## 8. How a deploy works

One command deploys one service to one environment:

```bash
pnpm nx deploy booking --env=dev
```

What happens inside, step by step:

1. **Build**: Nx runs esbuild. esbuild turns each Lambda's TypeScript, plus the packages it uses (e.g.
   `@vclinic/contracts`), into **one small JavaScript file**.
2. **Zip**: Terraform zips that file.
3. **Plan**: Terraform compares the code with the state and shows what will change.
4. **Apply**: Terraform uploads the zip and creates or updates the Lambda, its permissions and its trigger.

Later, GitHub Actions will run the same command automatically when code is merged.

## 9. Which event bus we chose, and why

We compared four AWS options for carrying events between services:

| Option          | Cost when nobody uses it  | Can route events by their content | Keeps events in order         | Work to run it |
| --------------- | ------------------------- | --------------------------------- | ----------------------------- | -------------- |
| **EventBridge** | $0                        | Yes, by any field                 | No                            | None           |
| SNS + SQS       | $0                        | Limited                           | Only with special FIFO queues | None           |
| Kinesis         | About $11+ per month      | No                                | Yes                           | Low            |
| MSK (Kafka)     | Expensive, always running | No                                | Yes                           | High           |

**Choice: EventBridge.**

- It costs nothing when idle, which matters for our $10 per month limit.
- Rules can pick events by name, e.g. "all `booking.*` events go to Audit", without changing Booking's code.
- We do not need ordering: our consumers already handle events that arrive in the wrong order (decision
  "Consumers tolerate out-of-order events" in `docs/02-event-catalog.md`).

What we give up: no ordering, and if we ever need very high volume or replaying old events for months, Kinesis
or Kafka would be better. We would revisit this choice then.

## 10. Rules to keep the bill under $10 per month

- No VPC and no NAT Gateway (a NAT Gateway alone costs about $35 per month).
- No always-running servers. Only pay-per-use services (Lambda, DynamoDB on-demand, SQS, EventBridge).
- Logs are kept for 7 days only.
- SSM Parameter Store (free) instead of Secrets Manager (paid).
- AWS-managed encryption keys (free) instead of our own KMS keys (about $1 each per month).
- Every environment can be removed with `terraform destroy`. If we are not using `tst` for a while, we
  destroy it.

## 11. Not built yet

- `prod` environment
- Login (Cognito)
- A website/frontend
- Separate AWS accounts per environment
