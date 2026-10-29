import { z } from 'zod';
import { defineEvent, type EventOf } from '../envelope';
import {
  id,
  isoDateTime,
  text,
  endsAfterStart,
  endsAfterStartError,
} from '../primitives';

/** Who triggered a change. `system` = automatic (e.g. a scheduled clean-up). */
export const actor = z.enum(['member', 'clinician', 'system']);

const AppointmentBookedSchema = z
  .object({
    appointmentId: id,
    memberId: id,
    clinicianId: id,
    slotId: id,
    startTime: isoDateTime,
    endTime: isoDateTime,
  })
  .refine(endsAfterStart, endsAfterStartError);

const AppointmentCancelledSchema = z
  .object({
    appointmentId: id,
    memberId: id,
    clinicianId: id,
    slotId: id,
    startTime: isoDateTime,
    endTime: isoDateTime,
    cancelledBy: actor,
    reason: text.optional(),
  })
  .refine(endsAfterStart, endsAfterStartError);

const AppointmentRescheduledSchema = z
  .object({
    appointmentId: id,
    memberId: id,
    clinicianId: id,
    previousSlotId: id,
    previousStartTime: isoDateTime,
    slotId: id,
    startTime: isoDateTime,
    endTime: isoDateTime,
    rescheduledBy: actor,
    reason: text.optional(),
  })
  .refine(endsAfterStart, endsAfterStartError);

const SlotSchema = z
  .object({
    slotId: id,
    startTime: isoDateTime,
    endTime: isoDateTime,
  })
  .refine(endsAfterStart, endsAfterStartError);

const SlotPublishedSchema = z.object({
  clinicianId: id,
  slots: z.array(SlotSchema).min(1),
});

const SlotWithdrawnSchema = z.object({
  clinicianId: id,
  slotIds: z.array(id).min(1),
});

export const SlotPublished = defineEvent(
  'booking.slot.published',
  1,
  SlotPublishedSchema,
);
export const SlotWithdrawn = defineEvent(
  'booking.slot.withdrawn',
  1,
  SlotWithdrawnSchema,
);
export const AppointmentBooked = defineEvent(
  'booking.appointment.booked',
  1,
  AppointmentBookedSchema,
);
export const AppointmentCancelled = defineEvent(
  'booking.appointment.cancelled',
  1,
  AppointmentCancelledSchema,
);
export const AppointmentRescheduled = defineEvent(
  'booking.appointment.rescheduled',
  1,
  AppointmentRescheduledSchema,
);

export type SlotPublishedEvent = EventOf<typeof SlotPublished>;
export type SlotWithdrawnEvent = EventOf<typeof SlotWithdrawn>;
export type AppointmentBookedEvent = EventOf<typeof AppointmentBooked>;
export type AppointmentCancelledEvent = EventOf<typeof AppointmentCancelled>;
export type AppointmentRescheduledEvent = EventOf<
  typeof AppointmentRescheduled
>;
