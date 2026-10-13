import { daysBetween, rate, toBrasiliaDay } from './report-days.js';

describe('report days', () => {
  it('uses the Brasília date, even when UTC is already the next day', () => {
    expect(toBrasiliaDay(new Date('2026-10-14T02:30:00Z'))).toBe('2026-10-13');
  });

  it('lists every day of the period, both ends included', () => {
    expect(
      daysBetween(
        new Date('2026-10-30T10:00:00-03:00'),
        new Date('2026-11-02T08:00:00-03:00'),
      ),
    ).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('rounds rates and has none without a total', () => {
    expect(rate(2, 3)).toBe(0.6667);
    expect(rate(0, 0)).toBeNull();
  });
});
