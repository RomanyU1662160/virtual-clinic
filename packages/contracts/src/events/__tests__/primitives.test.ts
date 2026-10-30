import { endsAfterStart } from '../../primitives';

describe('endsAfterStart', () => {
  it('is true when endTime is after startTime', () => {
    expect(
      endsAfterStart({
        startTime: '2026-10-25T10:00:00Z',
        endTime: '2026-10-25T11:00:00Z',
      }),
    ).toBe(true);
  });

  it.each([
    ['before', '2026-10-25T09:00:00Z'],
    ['equal to', '2026-10-25T10:00:00Z'],
  ])('is false when endTime is %s startTime', (_label, endTime) => {
    expect(endsAfterStart({ startTime: '2026-10-25T10:00:00Z', endTime })).toBe(
      false,
    );
  });

  it('compares instants, not strings, when precision differs', () => {
    // As strings, '...00.500Z' < '...00Z' because '.' sorts before 'Z'.
    expect(
      endsAfterStart({
        startTime: '2026-10-25T10:00:00Z',
        endTime: '2026-10-25T10:00:00.500Z',
      }),
    ).toBe(true);
  });
});
