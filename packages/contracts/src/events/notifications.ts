import { z } from 'zod';
import { defineEvent, type EventOf } from '../envelope';
import { id, text } from '../primitives';

export const channel = z.enum(['email', 'sms']);

/** Fixed codes only: provider error text can echo the recipient's address. */
export const notificationErrorCode = z.enum([
  'bounced',
  'invalid_address',
  'provider_error',
  'rate_limited',
]);

const NotificationSentSchema = z.object({
  notificationId: id,
  recipientType: z.enum(['member', 'clinician']),
  recipientId: id,
  channel,
  template: text,
  triggeredByEventId: id,
});

const NotificationFailedSchema = NotificationSentSchema.extend({
  errorCode: notificationErrorCode,
});

/** An empty list means the member opted out of optional messages (e.g. reminders). */
const PreferencesUpdatedSchema = z.object({
  memberId: id,
  channels: z.array(channel),
});

export const NotificationSent = defineEvent(
  'notifications.notification.sent',
  1,
  NotificationSentSchema,
);
export const NotificationFailed = defineEvent(
  'notifications.notification.failed',
  1,
  NotificationFailedSchema,
);
export const PreferencesUpdated = defineEvent(
  'notifications.preferences.updated',
  1,
  PreferencesUpdatedSchema,
);

export type NotificationSentEvent = EventOf<typeof NotificationSent>;
export type NotificationFailedEvent = EventOf<typeof NotificationFailed>;
export type PreferencesUpdatedEvent = EventOf<typeof PreferencesUpdated>;
