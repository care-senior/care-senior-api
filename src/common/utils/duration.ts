const UNIT_TO_MS = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

const DURATION_PATTERN = /^(\d+)([smhd])$/;

export function parseDurationToMs(duration: string): number {
  const match = DURATION_PATTERN.exec(duration.trim());
  if (!match) {
    throw new Error(
      `Invalid duration "${duration}". Use a number followed by s, m, h or d (e.g. 15m).`,
    );
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_TO_MS[unit as keyof typeof UNIT_TO_MS];
}
