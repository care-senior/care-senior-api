import { Weekday } from '../../../common/enums/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS_FROM_SUNDAY = [
  Weekday.SUN,
  Weekday.MON,
  Weekday.TUE,
  Weekday.WED,
  Weekday.THU,
  Weekday.FRI,
  Weekday.SAT,
];
const BRASILIA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
});

/** How far ahead the routines keep the agenda filled. */
export const GENERATION_WINDOW_MS = 7 * DAY_MS;

/**
 * Instants in (from, to] when a routine happens. `time` is the wall-clock
 * time in Brasília (UTC-3, no daylight saving since 2019), like every clinic
 * until a clinic time zone is modeled.
 */
export function occurrencesBetween(
  time: string,
  weekdays: Weekday[],
  from: Date,
  to: Date,
): Date[] {
  const occurrences: Date[] = [];
  const lastDay = BRASILIA_DATE.format(to);
  for (
    let day = BRASILIA_DATE.format(from);
    day <= lastDay;
    day = nextDay(day)
  ) {
    const weekday =
      WEEKDAYS_FROM_SUNDAY[new Date(`${day}T12:00:00Z`).getUTCDay()]!;
    if (!weekdays.includes(weekday)) continue;
    const occurrence = new Date(`${day}T${time}:00-03:00`);
    if (occurrence > from && occurrence <= to) {
      occurrences.push(occurrence);
    }
  }
  return occurrences;
}

function nextDay(day: string): string {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() + DAY_MS)
    .toISOString()
    .slice(0, 10);
}
