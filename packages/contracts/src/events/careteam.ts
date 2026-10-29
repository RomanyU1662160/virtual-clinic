import { z } from 'zod';
import { defineEvent, type EventOf } from '../envelope';
import { id, email, phone, text } from '../primitives';

/** Full clinician profile: registered and updated events both carry a complete snapshot. */
const ClinicianProfile = z.object({
  clinicianId: id,
  title: text.optional(),
  firstName: text,
  lastName: text,
  specialty: text,
  email,
  phone: phone.optional(),
});

const ClinicianUpdatedSchema = ClinicianProfile.extend({
  changedFields: z
    .array(ClinicianProfile.keyof().exclude(['clinicianId']))
    .min(1),
});

export const ClinicianRegistered = defineEvent(
  'careteam.clinician.registered',
  1,
  ClinicianProfile,
);
export const ClinicianUpdated = defineEvent(
  'careteam.clinician.updated',
  1,
  ClinicianUpdatedSchema,
);

export type ClinicianRegisteredEvent = EventOf<typeof ClinicianRegistered>;
export type ClinicianUpdatedEvent = EventOf<typeof ClinicianUpdated>;
