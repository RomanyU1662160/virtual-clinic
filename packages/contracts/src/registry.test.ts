import { ZodError } from 'zod';
import { createEvent } from './envelope';
import { AppointmentBooked, AppointmentCancelled } from './events/booking';
import {
  eventDefinitions,
  eventKey,
  isEventOf,
  parseEvent,
  UnknownEventError,
} from './registry';

const uuid = () => crypto.randomUUID();
const bookedEvent = () =>
  createEvent(
    AppointmentBooked,
    {
      appointmentId: uuid(),
      memberId: uuid(),
      clinicianId: uuid(),
      slotId: uuid(),
      startTime: '2026-10-25T10:00:00Z',
      endTime: '2026-10-25T10:45:00Z',
    },
    { correlationId: uuid() },
  );
// Simulates what a consumer receives: JSON text from SQS.
const overTheWire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value));

describe('event registry', () => {
  it('registers all 14 MVP events from the catalog, each once', () => {
    const keys = eventDefinitions.map((d) =>
      eventKey(d.eventType, d.eventVersion),
    );
    expect(keys).toHaveLength(14);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('follows the <context>.<entity>.<past-tense-verb> naming convention', () => {
    for (const { eventType } of eventDefinitions) {
      expect(eventType).toMatch(/^[a-z]+\.[a-z]+\.[a-z]+$/);
    }
  });
});

describe('parseEvent', () => {
  it('parses a known event received as JSON', () => {
    const sent = bookedEvent();
    expect(parseEvent(overTheWire(sent))).toEqual(sent);
  });

  it('throws UnknownEventError for an unregistered eventType', () => {
    const event = overTheWire(bookedEvent()) as {
      metadata: { eventType: string };
    };
    event.metadata.eventType = 'booking.appointment.teleported';
    expect(() => parseEvent(event)).toThrow(UnknownEventError);
  });

  it('throws UnknownEventError for an unregistered version', () => {
    const event = overTheWire(bookedEvent()) as {
      metadata: { eventVersion: number };
    };
    event.metadata.eventVersion = 2;
    expect(() => parseEvent(event)).toThrow(
      'Unknown event: booking.appointment.booked@v2',
    );
  });

  it('throws ZodError for input without metadata', () => {
    expect(() => parseEvent({ hello: 'world' })).toThrow(ZodError);
  });

  it('throws ZodError when a known event has invalid data', () => {
    const event = overTheWire(bookedEvent()) as { data: { memberId: string } };
    event.data.memberId = 'not-a-uuid';
    expect(() => parseEvent(event)).toThrow(ZodError);
  });
});

describe('isEventOf', () => {
  it('narrows a DomainEvent to a specific event', () => {
    const event = parseEvent(overTheWire(bookedEvent()));
    expect(isEventOf(AppointmentBooked, event)).toBe(true);
    expect(isEventOf(AppointmentCancelled, event)).toBe(false);
    if (isEventOf(AppointmentBooked, event)) {
      // Compiles only because the guard narrowed the type.
      expect(event.data.startTime).toBe('2026-10-25T10:00:00Z');
    }
  });
});
