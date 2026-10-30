import { createEvent } from '../../envelope';
import { AppointmentBooked } from '../booking';

const uuid = () => crypto.randomUUID();
const bookedData = () => ({
  appointmentId: uuid(),
  memberId: uuid(),
  clinicianId: uuid(),
  slotId: uuid(),
  startTime: '2026-10-25T10:00:00Z',
  endTime: '2026-10-25T10:45:00Z',
});

describe('createEvent', () => {
  it('fills eventId, occurredAt, type and version from the definition', () => {
    const correlationId = uuid();
    const event = createEvent(AppointmentBooked, bookedData(), {
      correlationId,
    });

    expect(event.metadata).toEqual({
      eventId: expect.any(String),
      eventType: 'booking.appointment.booked',
      eventVersion: 1,
      occurredAt: expect.any(String),
      correlationId,
    });
    expect(Number.isNaN(Date.parse(event.metadata.occurredAt))).toBe(false);
  });

  it('keeps the causationId when given', () => {
    const causationId = uuid();
    const event = createEvent(AppointmentBooked, bookedData(), {
      correlationId: uuid(),
      causationId,
    });
    expect(event.metadata.causationId).toBe(causationId);
  });

  it('gives every event a new eventId', () => {
    const ctx = { correlationId: uuid() };
    const a = createEvent(AppointmentBooked, bookedData(), ctx);
    const b = createEvent(AppointmentBooked, bookedData(), ctx);
    expect(a.metadata.eventId).not.toBe(b.metadata.eventId);
  });

  it('strips fields that are not in the schema (no accidental data leaks)', () => {
    const dbRecord = { ...bookedData(), diagnosis: 'must never be published' };
    const event = createEvent(AppointmentBooked, dbRecord, {
      correlationId: uuid(),
    });
    expect(event.data).not.toHaveProperty('diagnosis');
  });

  it('throws when the data is invalid', () => {
    const invalid = { ...bookedData(), endTime: '2026-10-25T09:00:00Z' };
    expect(() =>
      createEvent(AppointmentBooked, invalid, { correlationId: uuid() }),
    ).toThrow('endTime must be after startTime');
  });
});
