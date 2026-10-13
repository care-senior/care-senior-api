import { Weekday } from '../../../common/enums/index.js';
import { occurrencesBetween } from './routine-schedule.js';

describe('occurrencesBetween', () => {
  // 2026-10-13 is a Tuesday.
  const from = new Date('2026-10-13T10:00:00-03:00');
  const to = new Date('2026-10-20T10:00:00-03:00');

  it('returns the weekdays at the Brasília time inside the window', () => {
    expect(
      occurrencesBetween('07:30', [Weekday.MON, Weekday.WED], from, to),
    ).toEqual([
      new Date('2026-10-14T10:30:00Z'),
      new Date('2026-10-19T10:30:00Z'),
    ]);
  });

  it('skips today when the time already passed and includes the end', () => {
    expect(occurrencesBetween('09:00', [Weekday.TUE], from, to)).toEqual([
      new Date('2026-10-20T12:00:00Z'),
    ]);
    expect(occurrencesBetween('10:00', [Weekday.TUE], from, to)).toEqual([
      new Date('2026-10-20T13:00:00Z'),
    ]);
  });

  it('keeps the Brasília date late at night, when UTC is already tomorrow', () => {
    expect(
      occurrencesBetween(
        '23:30',
        [Weekday.TUE],
        new Date('2026-10-13T22:00:00-03:00'),
        new Date('2026-10-14T22:00:00-03:00'),
      ),
    ).toEqual([new Date('2026-10-14T02:30:00Z')]);
  });
});
