import { z } from 'zod';
import { defineEvent, type EventOf } from '../envelope';
import { id, email, phone, text } from '../primitives';

// Partner: the access code itself is a secret and is never published.
const PartnerRegisteredSchema = z.discriminatedUnion('eligibilityType', [
  z.object({
    partnerId: id,
    name: text,
    eligibilityType: z.literal('accessCode'),
  }),
  z.object({
    partnerId: id,
    name: text,
    eligibilityType: z.literal('emailDomain'),
    emailDomain: z.hostname(),
  }),
]);

const MemberInvitedSchema = z.object({
  memberId: id,
  partnerId: id,
  email,
  firstName: text,
});

/** Full member profile: activated and updated events both carry a complete snapshot. */
const MemberProfile = z.object({
  memberId: id,
  partnerId: id,
  email,
  phone: phone.optional(),
  title: text.optional(),
  firstName: text,
  lastName: text,
});

const MemberUpdatedSchema = MemberProfile.extend({
  changedFields: z
    .array(MemberProfile.keyof().exclude(['memberId', 'partnerId']))
    .min(1),
});

export const PartnerRegistered = defineEvent(
  'membership.partner.registered',
  1,
  PartnerRegisteredSchema,
);
export const MemberInvited = defineEvent(
  'membership.member.invited',
  1,
  MemberInvitedSchema,
);
export const MemberActivated = defineEvent(
  'membership.member.activated',
  1,
  MemberProfile,
);
export const MemberUpdated = defineEvent(
  'membership.member.updated',
  1,
  MemberUpdatedSchema,
);

export type PartnerRegisteredEvent = EventOf<typeof PartnerRegistered>;
export type MemberInvitedEvent = EventOf<typeof MemberInvited>;
export type MemberActivatedEvent = EventOf<typeof MemberActivated>;
export type MemberUpdatedEvent = EventOf<typeof MemberUpdated>;
