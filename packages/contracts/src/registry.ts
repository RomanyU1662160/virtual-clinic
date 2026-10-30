import { z } from 'zod';
import { metadataSchema, type EventOf } from './envelope';
import {
  PartnerRegistered,
  MemberInvited,
  MemberActivated,
  MemberUpdated,
} from './events/membership';
import { ClinicianRegistered, ClinicianUpdated } from './events/careteam';
import {
  SlotPublished,
  SlotWithdrawn,
  AppointmentBooked,
  AppointmentCancelled,
  AppointmentRescheduled,
} from './events/booking';
import {
  NotificationSent,
  NotificationFailed,
  PreferencesUpdated,
} from './events/notifications';

/** Every event the system knows. Adding an event = add it here (a test checks the count). */
export const eventDefinitions = [
  PartnerRegistered,
  MemberInvited,
  MemberActivated,
  MemberUpdated,
  ClinicianRegistered,
  ClinicianUpdated,
  SlotPublished,
  SlotWithdrawn,
  AppointmentBooked,
  AppointmentCancelled,
  AppointmentRescheduled,
  NotificationSent,
  NotificationFailed,
  PreferencesUpdated,
] as const;

export type AnyEventDefinition = (typeof eventDefinitions)[number];
/** Union of every event type, e.g. for Audit, which consumes all of them. */
export type DomainEvent = EventOf<AnyEventDefinition>;

export const eventKey = (eventType: string, eventVersion: number) =>
  `${eventType}@v${eventVersion}`;

const registry = new Map<string, AnyEventDefinition>();
for (const definition of eventDefinitions) {
  const key = eventKey(definition.eventType, definition.eventVersion);
  if (registry.has(key)) throw new Error(`Duplicate event definition: ${key}`);
  registry.set(key, definition);
}

/** Thrown when an event's type/version isn't registered (route it to the DLQ). */
export class UnknownEventError extends Error {
  constructor(
    readonly eventType: string,
    readonly eventVersion: number,
  ) {
    super(`Unknown event: ${eventKey(eventType, eventVersion)}`);
    this.name = 'UnknownEventError';
  }
}

// Step 1 reads only what's needed to find the schema; the rest is still untrusted.
const eventHeader = z.object({
  metadata: metadataSchema.pick({ eventType: true, eventVersion: true }),
});

/**
 * Validates unknown input (e.g. a parsed SQS body) against the right registered schema.
 * Throws ZodError for malformed events and UnknownEventError for unregistered ones.
 */
export function parseEvent(input: unknown): DomainEvent {
  const { metadata } = eventHeader.parse(input);
  const definition = registry.get(
    eventKey(metadata.eventType, metadata.eventVersion),
  );
  if (!definition) {
    throw new UnknownEventError(metadata.eventType, metadata.eventVersion);
  }
  return definition.schema.parse(input) as DomainEvent;
}

/**
 * Type guard: narrows a DomainEvent to one specific event.
 * Needed because TypeScript doesn't narrow on nested fields like `event.metadata.eventType`.
 */
export function isEventOf<TDefinition extends AnyEventDefinition>(
  definition: TDefinition,
  event: DomainEvent,
): event is EventOf<TDefinition> {
  return (
    event.metadata.eventType === definition.eventType &&
    event.metadata.eventVersion === definition.eventVersion
  );
}
