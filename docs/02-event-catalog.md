# 02 — Event Catalog

> Status: Agreed v2 · 2026-10-26

## Conventions

- **Name:** `<context>.<entity>.<past-tense-verb>`, e.g. `booking.appointment.booked`.
- **Fields:** flat and camelCase (`memberId`, not `member { MemberId }`).
- **Envelope:** every event is wrapped in `{ metadata, data }`. `metadata` holds `eventId`, `eventType`,
  `eventVersion`, `occurredAt`, `correlationId` and `causationId`, so those never repeat inside `data`.
- **Minimal data:** a field is included only if a listed consumer needs it.
- **Times:** ISO-8601 UTC strings (`2026-10-25T10:00:00Z`).

## Bounded contexts (services)

| Context       | Owns                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Membership    | Partners, eligibility, members (patients) and their invite/sign-up lifecycle                     |
| Care Team     | Clinicians: profile, specialty, contact details                                                  |
| Booking       | Slots and appointments (kept together so FR-7 "no double booking" is a single conditional write) |
| Notifications | Contact read-models, preferences, reminder schedules, sent messages                              |
| Audit         | Append-only log of every event                                                                   |

> Logging in (identity) is a separate concern from domain ownership. Members, clinicians and partner admins
> will all sign in through one identity provider (Cognito, later) with different roles, but each kind of
> person is _owned_ by a different context.

## Events

> Personal data column: **Yes (health)** = linking a member to an appointment or clinician reveals they
> receive cancer care, which is special-category data under UK GDPR. Never log `data` for these events.

### Membership

| Event type                      | Consumers            | `data` fields                                                                       | Personal data? |
| ------------------------------- | -------------------- | ----------------------------------------------------------------------------------- | -------------- |
| `membership.partner.registered` | Audit                | `partnerId`, `name`, `eligibilityType` (`accessCode` \| `emailDomain`)              | No             |
| `membership.member.invited`     | Notifications, Audit | `memberId`, `partnerId`, `email`, `firstName`                                       | Yes            |
| `membership.member.activated`   | Notifications, Audit | `memberId`, `partnerId`, `email`, `phone?`, `title?`, `firstName`, `lastName`       | Yes            |
| `membership.member.updated`     | Notifications, Audit | `memberId`, `changedFields[]`, `email`, `phone?`, `title?`, `firstName`, `lastName` | Yes            |

### Care Team

| Event type                      | Consumers                     | `data` fields                                                                    | Personal data?     |
| ------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- | ------------------ |
| `careteam.clinician.registered` | Booking, Notifications, Audit | `clinicianId`, `title?`, `firstName`, `lastName`, `specialty`, `email`, `phone?` | Yes (professional) |
| `careteam.clinician.updated`    | Booking, Notifications, Audit | `clinicianId`, `changedFields[]`, then the same fields as `registered`           | Yes (professional) |

### Booking

| Event type                        | Consumers            | `data` fields                                                                                                                        | Personal data? |
| --------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `booking.slot.published`          | Audit                | `clinicianId`, `slots[] { slotId, startTime, endTime }`                                                                              | No             |
| `booking.slot.withdrawn`          | Audit                | `clinicianId`, `slotIds[]`                                                                                                           | No             |
| `booking.appointment.booked`      | Notifications, Audit | `appointmentId`, `memberId`, `clinicianId`, `slotId`, `startTime`, `endTime`                                                         | Yes (health)   |
| `booking.appointment.cancelled`   | Notifications, Audit | `appointmentId`, `memberId`, `clinicianId`, `slotId`, `startTime`, `cancelledBy` (`member` \| `clinician` \| `system`), `reason?`    | Yes (health)   |
| `booking.appointment.rescheduled` | Notifications, Audit | `appointmentId`, `memberId`, `clinicianId`, `previousSlotId`, `previousStartTime`, `slotId`, `startTime`, `endTime`, `rescheduledBy` | Yes (health)   |

### Notifications

| Event type                          | Consumers | `data` fields                                                                                                                              | Personal data?                |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `notifications.notification.sent`   | Audit     | `notificationId`, `recipientType` (`member` \| `clinician`), `recipientId`, `channel` (`email` \| `sms`), `template`, `triggeredByEventId` | Yes (low: no message content) |
| `notifications.notification.failed` | Audit     | same as `sent` + `errorCode`                                                                                                               | Yes (low)                     |
| `notifications.preferences.updated` | Audit     | `memberId`, `channels[]`                                                                                                                   | Yes (low)                     |

## Why each consumer needs it

- **Notifications ← member events:** keeps its own contacts read-model (email, phone for SMS, title/name for
  "Dear Ms Smith"), so a reminder never depends on Membership being up (see D1).
- **Notifications ← clinician events:** the confirmation tells the member who they're seeing, and FR-8 also
  notifies the clinician of new bookings and cancellations.
- **Notifications ← appointment events:** sends confirmations and creates/updates/deletes the 24h and 1h reminder
  schedules. `startTime` is required for this.
- **Booking ← clinician events:** keeps `clinicianId → name, specialty` locally, so members can search slots by
  specialty (FR-5).
- **A clinician withdraws a slot that is already booked:** Booking emits `booking.appointment.cancelled` with
  `cancelledBy: clinician`, so the member is notified. `slot.withdrawn` alone means nobody had booked it.
- **Slot events → Audit only:** no other service needs to react to availability changes.
- **Removed:** Membership no longer consumes appointment events (it had nothing to do with them). Address,
  contact person and opening hours were dropped: this is a virtual clinic (video sessions), and availability
  is already modelled as slots.

## Design decisions

### D1 — Notifications keeps its own contact read-model (option b)

**Question:** Notifications needs a member's email to confirm a booking, but `booking.appointment.booked` comes
from Booking, which doesn't own contact details.

| Option                                                             | Verdict                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (a) Put the email in the appointment event                         | ❌ Booking would have to fetch or store contact data it doesn't own; personal data spreads into every appointment event, DLQ and archive; a reminder 24h later would use a possibly stale email. |
| **(b) Notifications keeps its own copy, built from member events** | ✅ **Chosen**                                                                                                                                                                                    |
| (c) Notifications calls the Membership API at send time            | ⚠️ Valid, but adds a runtime dependency: if Membership is down, nothing is sent until retries succeed.                                                                                           |

**Why (b):** Notifications keeps working when Membership is down, and the copy stays in sync automatically
through `membership.member.activated` / `membership.member.updated`. It is a read-only read-model: Membership
remains the single source of truth.

**Costs we accept:** a few seconds of eventual consistency after a profile update; one more (encrypted) copy of
contact data; a one-off backfill if Notifications is ever deployed after members already exist.

**Never:** read Membership's database directly (shared-database anti-pattern).

### D2 — Reminders (FR-9) are owned by Notifications and use one-time schedules

- `booking.appointment.booked` → create two EventBridge Scheduler one-time schedules: `startTime − 24h` and `startTime − 1h`.
- `booking.appointment.rescheduled` → update both schedules.
- `booking.appointment.cancelled` → delete both schedules.
- When a schedule fires: check the appointment is still active, and send only if it is. This covers the case
  where deleting a schedule failed.
- The reminder carries only what it needs (appointment time, clinician name), with no clinical details.

**Rejected:** a cron job that scans for upcoming appointments every minute. It polls forever, mostly finds
nothing, and gets slower as data grows.

### D3 — Every consumer is idempotent

Delivery is at-least-once, so the same event can arrive twice. Without protection the member gets duplicate
emails or SMS. Consumers record each processed `metadata.eventId` (Powertools Idempotency, DynamoDB with TTL)
and skip duplicates.

**Known limit:** this gives "effectively once", not "exactly once". If a Lambda sends the email and crashes
before recording the `eventId`, the retry sends it again. We accept that small window.

### D4 — Consumers tolerate out-of-order events

Ordering is not guaranteed: `cancelled` can arrive before `booked`.

- **Audit:** arrival order doesn't matter for an append-only log, but each entry stores `metadata.occurredAt`
  and queries sort by it, so the trail tells the story in the right order.
- **Notifications:** a real bug if ignored. A late `booked` after `cancelled` would send a confirmation and
  create reminders for a cancelled appointment. Notifications stores each appointment's latest status and
  `occurredAt`, and **ignores events older than the stored state**.

## Notifications' own data

| Table / store       | Built from                                                    | Used for                                               |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| Member contacts     | `membership.member.activated`, `membership.member.updated`    | Email/SMS address, name, title                         |
| Clinician contacts  | `careteam.clinician.registered`, `careteam.clinician.updated` | Clinician name in messages; notifying clinicians       |
| Preferences         | Member API calls (FR-10)                                      | Which channels a member wants                          |
| Appointment status  | `booking.appointment.*`                                       | "Still active?" check (D2), ignoring stale events (D4) |
| Reminder schedules  | EventBridge Scheduler (named by `appointmentId`)              | FR-9                                                   |
| Idempotency records | Every consumed event                                          | Skipping duplicates (D3)                               |
