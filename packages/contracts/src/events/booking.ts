import { z } from 'zod';
import { defineEvent, type EventOf } from '../envelope';
import { id, isoDateTime } from '../primitives';

const AppointmentBookedSchema = z.object({
  appointmentId: id,
  memberId: id,
  clinicianId: id,
  slotId: id,
  startTime: isoDateTime,
  endTime: isoDateTime,
});

export const AppointmentBooked = defineEvent(
  'booking.appointment.booked',
  1,
  AppointmentBookedSchema,
);

export type AppointmentBookedEvent = EventOf<typeof AppointmentBooked>;
