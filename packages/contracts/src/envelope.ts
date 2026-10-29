import { z, ZodType } from 'zod';
import { id, isoDateTime } from './primitives';

export const metadataSchema = z.object({
  eventId: id,
  eventType: z.string(),
  eventVersion: z.number().int().positive(),
  occurredAt: isoDateTime,
  correlationId: id,
  causationId: id.optional(),
});
export type EventMetaData = z.infer<typeof metadataSchema>;

/** Declares one event type + version and builds its full envelope schema.
 * @example
 * const userCreatedEvent = defineEvent('AppointmentBooked', 1, z.object({
 *   userId: id,
 *   email: z.string().email(),
 * }));
 */
export function defineEvent<
  TType extends string,
  TVersion extends number,
  TData extends z.ZodType,
>(eventType: TType, eventVersion: TVersion, data: TData) {
  const schema = z.object({
    metadata: metadataSchema.extend({
      eventType: z.literal(eventType),
      eventVersion: z.literal(eventVersion),
    }),
    data,
  });
  return { eventType, eventVersion, schema } as const;
}

/** The TypeScript type of a defined event, e.g. EventOf<typeof AppointmentBooked>. */
export type EventOf<T extends { schema: ZodType }> = z.infer<T['schema']>;
export type EventDefinition = ReturnType<typeof defineEvent>;
export type EventSchema = ReturnType<typeof defineEvent>['schema'];

export const createEvent = <TDefinition extends EventDefinition>(
  definition: TDefinition,
  data: EventOf<TDefinition>['data'],
  context: {
    correlationId: string;
    causationId?: string;
  },
) => {
  const eventId = crypto.randomUUID();
  const occurredAt = new Date().toISOString();

  const metadata: EventMetaData = {
    eventId,
    eventType: definition.eventType,
    eventVersion: definition.eventVersion,
    occurredAt,
    correlationId: context.correlationId,
    causationId: context.causationId,
  };

  return definition.schema.parse({ metadata, data }) as EventOf<TDefinition>;
};
