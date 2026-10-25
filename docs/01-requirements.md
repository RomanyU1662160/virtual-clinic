# 01 — Requirements

> Status: Draft v1 · 2026-10-24
> Learning project: an event-driven virtual clinic for people living with or beyond cancer.
> A fictional domain; it holds no real patient data.

## Context

- Members (people living with or beyond cancer) get access through a **partner** (an employer or insurer).
- Members book sessions with **clinicians** (nurses, dietitians, physios, psychologists).
- **Partner admins** manage their organisation's eligibility.

## MVP scope (bounded contexts)

| Context | Owns |
|---|---|
| Membership | Partners, eligibility rules, members |
| Booking | Clinician availability slots, appointments |
| Notifications | Notification preferences, sent messages |
| Audit | Immutable log of every state-changing event |

Out of scope: video consultations, clinical notes, billing, frontend, Cognito auth (added later).

## Functional requirements

**Membership**
- FR-1 Register a partner with an eligibility rule (access code or email domain).
- FR-2 Member signs up with an access code; eligibility is validated → `MemberRegistered`.
- FR-3 Member views/updates profile → `MemberProfileUpdated`.

**Booking**
- FR-4 Clinician publishes availability slots.
- FR-5 Member searches slots by specialty and books one → `AppointmentBooked`.
- FR-6 Member or clinician cancels/reschedules → `AppointmentCancelled` / `AppointmentRescheduled`.
- FR-7 A slot can never be double-booked.

**Notifications**
- FR-8 Confirmation message on booking, cancellation and reschedule.
- FR-9 Reminders 24h and 1h before an appointment.
- FR-10 Members set notification preferences.

**Audit**
- FR-11 Every domain event is appended to an immutable audit log (who, what, when).
- FR-12 Admin queries the audit trail for a member.

## Non-functional requirements

| Category | Requirement |
|---|---|
| Cost | **Whole AWS account < $10/month.** No NAT gateways, no VPC, no always-on compute. AWS-managed KMS keys, SSM Parameter Store (standard) for config. AWS Budget alarm at $5 and $8. Every env must come down with `terraform destroy`. |
| Compliance (designed-for) | Patterns suitable for UK GDPR special-category data: region `eu-west-2`, encryption at rest and in transit, no health data in logs, audit trail. Synthetic data only. |
| Security | Least-privilege IAM role per Lambda; no long-lived AWS keys in CI (GitHub OIDC). |
| Availability | Target 99.9% for APIs (managed services give us this). |
| Latency | API p95 < 300 ms; event → notification p95 < 30 s. |
| Consistency | Strong for slot booking (conditional write); eventual elsewhere. |
| Delivery | At-least-once. Every consumer is idempotent. Failed events land in a DLQ, none are lost. |
| Auditability | Audit log is append-only. |
| Deployability | Any single service deploys on its own with one command in < 10 min. |
| Environments | `dev`, `tst` from the same Terraform with different variables. Optional personal stacks (`dev-<name>`). |
| Testability | Unit + integration tests run locally (LocalStack) before a PR. |
| Observability | Structured JSON logs, correlation ID across events, X-Ray tracing, alarms on errors and DLQ depth. |
| Maintainability | Strict TypeScript, shared event contracts in one library, ≥ 80% coverage on domain logic. |

## Load estimate

50k eligible members × 10% monthly active × 2 bookings ≈ 10k bookings/month
≈ 0.005 bookings/s on average (~1/s peak), ~100k events/month.

**Conclusion:** scale is not the hard part. Correctness, compliance patterns, cost and team speed are. That's why we chose serverless (Lambda + DynamoDB + EventBridge), and it keeps us inside the free tier.

## Constraints

- Nx monorepo · Node.js + TypeScript · Jest · Terraform · AWS
- Personal GitHub and AWS accounts (one AWS account hosts both envs, separated by name prefix)
- Learning-first: prefer clarity over cleverness; write an ADR for each significant decision.
