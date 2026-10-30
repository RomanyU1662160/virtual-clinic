import { MemberUpdated, PartnerRegistered } from '../membership';

const uuid = () => crypto.randomUUID();
const metadata = (eventType: string) => ({
  eventId: uuid(),
  eventType,
  eventVersion: 1,
  occurredAt: '2026-10-20T09:00:00Z',
  correlationId: uuid(),
});

describe('membership.partner.registered', () => {
  const partner = (data: Record<string, unknown>) => ({
    metadata: metadata('membership.partner.registered'),
    data: { partnerId: uuid(), name: 'Acme Insurance', ...data },
  });

  it('accepts accessCode eligibility without an emailDomain', () => {
    expect(
      PartnerRegistered.schema.safeParse(
        partner({ eligibilityType: 'accessCode' }),
      ).success,
    ).toBe(true);
  });

  it('requires emailDomain for emailDomain eligibility', () => {
    expect(
      PartnerRegistered.schema.safeParse(
        partner({ eligibilityType: 'emailDomain' }),
      ).success,
    ).toBe(false);
  });

  it('accepts a valid hostname as emailDomain', () => {
    expect(
      PartnerRegistered.schema.safeParse(
        partner({ eligibilityType: 'emailDomain', emailDomain: 'acme.co.uk' }),
      ).success,
    ).toBe(true);
  });

  it('never publishes an access code', () => {
    const result = PartnerRegistered.schema.safeParse(
      partner({ eligibilityType: 'accessCode', accessCode: 'SECRET-123' }),
    );
    expect(result.data?.data).not.toHaveProperty('accessCode');
  });
});

describe('membership.member.updated', () => {
  const updated = (data: Record<string, unknown> = {}) => ({
    metadata: metadata('membership.member.updated'),
    data: {
      memberId: uuid(),
      partnerId: uuid(),
      email: 'sam@example.com',
      phone: '+447700900123',
      firstName: 'Sam',
      lastName: 'Taylor',
      changedFields: ['phone'],
      ...data,
    },
  });

  it('accepts a full snapshot with changedFields', () => {
    expect(MemberUpdated.schema.safeParse(updated()).success).toBe(true);
  });

  it('rejects an unknown field name in changedFields', () => {
    expect(
      MemberUpdated.schema.safeParse(updated({ changedFields: ['emial'] }))
        .success,
    ).toBe(false);
  });

  it('rejects ids in changedFields (ids never change)', () => {
    expect(
      MemberUpdated.schema.safeParse(updated({ changedFields: ['memberId'] }))
        .success,
    ).toBe(false);
  });

  it('rejects an empty changedFields list', () => {
    expect(
      MemberUpdated.schema.safeParse(updated({ changedFields: [] })).success,
    ).toBe(false);
  });

  it('rejects a phone number that is not E.164', () => {
    expect(
      MemberUpdated.schema.safeParse(updated({ phone: '07700900123' })).success,
    ).toBe(false);
  });
});
