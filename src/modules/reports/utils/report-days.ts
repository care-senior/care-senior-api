const DAY_MS = 24 * 60 * 60 * 1000;
const BRASILIA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
});

/** SQL for the Brasília date of a timestamptz column, as `YYYY-MM-DD`. */
export const brasiliaDay = (column: string) =>
  `(${column} AT TIME ZONE 'America/Sao_Paulo')::date::text`;

/** `YYYY-MM-DD` of an instant in Brasília, where every clinic is for now. */
export function toBrasiliaDay(instant: Date): string {
  return BRASILIA_DATE.format(instant);
}

/** Every Brasília day from `from` to `to`, both included. */
export function daysBetween(from: Date, to: Date): string[] {
  const days: string[] = [];
  const last = toBrasiliaDay(to);
  for (let day = toBrasiliaDay(from); day <= last;) {
    days.push(day);
    day = new Date(new Date(`${day}T12:00:00Z`).getTime() + DAY_MS)
      .toISOString()
      .slice(0, 10);
  }
  return days;
}

/** `part / total`, rounded to 4 places; null when there is nothing to measure. */
export function rate(part: number, total: number): number | null {
  return total === 0 ? null : Math.round((part / total) * 10_000) / 10_000;
}
