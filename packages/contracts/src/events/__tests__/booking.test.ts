import {
  AppointmentBooked,
  AppointmentCancelled,
  SlotPublished,
} from '../booking';

const uuid = () => crypto.randomUUID();
const metadata = (eventType: string) => ({
  eventId: uuid(),
  eventType,
  eventVersion: 1,
  occurredAt: '2026-10-20T09:00:00Z',
  correlationId: uuid(),
});
const booked = (data: Record<string, unknown> = {}) => ({
  metadata: metadata('booking.appointment.booked'),
  data: {
    appointmentId: uuid(),
    memberId: uuid(),
    clinicianId: uuid(),
    slotId: uuid(),
    startTime: '2026-10-25T10:00:00Z',
    endTime: '2026-10-25T10:45:00Z',
    ...data,
  },
});

describe('booking.appointment.booked', () => {
  it('accepts a valid event', () => {
    expect(AppointmentBooked.schema.safeParse(booked()).success).toBe(true);
  });

  it('rejects a missing startTime', () => {
    const event = booked();
    delete (event.data as Record<string, unknown>).startTime;
    expect(AppointmentBooked.schema.safeParse(event).success).toBe(false);
  });

  it('reports endTime before startTime as a validation failure, without throwing', () => {
    const result = AppointmentBooked.schema.safeParse(
      booked({ endTime: '2026-10-25T09:00:00Z' }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['data', 'endTime']);
  });

  it('rejects a time with an offset (UTC only)', () => {
    const result = AppointmentBooked.schema.safeParse(
      booked({ startTime: '2026-10-25T10:00:00+01:00' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects the wrong eventType in metadata', () => {
    const event = {
      ...booked(),
      metadata: metadata('booking.appointment.cancelled'),
    };
    expect(AppointmentBooked.schema.safeParse(event).success).toBe(false);
  });

  it('rejects eventVersion 2 for a v1 definition', () => {
    const event = booked();
    event.metadata.eventVersion = 2;
    expect(AppointmentBooked.schema.safeParse(event).success).toBe(false);
  });

  it('ignores unknown fields (tolerant reader): they are stripped, not rejected', () => {
    const result = AppointmentBooked.schema.safeParse(
      booked({ addedInAFutureVersion: 'x' }),
    );
    expect(result.success).toBe(true);
    expect(result.data?.data).not.toHaveProperty('addedInAFutureVersion');
  });
});

describe('booking.appointment.cancelled', () => {
  const cancelled = (cancelledBy: string) => ({
    metadata: metadata('booking.appointment.cancelled'),
    data: { ...booked().data, cancelledBy },
  });

  it.each(['member', 'clinician', 'system'])('accepts cancelledBy %s', (by) => {
    expect(AppointmentCancelled.schema.safeParse(cancelled(by)).success).toBe(
      true,
    );
  });

  it('rejects an unknown actor', () => {
    expect(
      AppointmentCancelled.schema.safeParse(cancelled('partner')).success,
    ).toBe(false);
  });
});

describe('booking.slot.published', () => {
  const published = (slots: unknown[]) => ({
    metadata: metadata('booking.slot.published'),
    data: { clinicianId: uuid(), slots },
  });

  it('rejects an empty slots list', () => {
    expect(SlotPublished.schema.safeParse(published([])).success).toBe(false);
  });

  it('applies the time rule to every slot', () => {
    const result = SlotPublished.schema.safeParse(
      published([
        {
          slotId: uuid(),
          startTime: '2026-10-25T10:00:00Z',
          endTime: '2026-10-25T10:45:00Z',
        },
        {
          slotId: uuid(),
          startTime: '2026-10-25T12:00:00Z',
          endTime: '2026-10-25T11:00:00Z',
        },
      ]),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([
      'data',
      'slots',
      1,
      'endTime',
    ]);
  });
});
