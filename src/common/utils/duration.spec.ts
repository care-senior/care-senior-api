import { parseDurationToMs } from './duration.js';

describe('parseDurationToMs', () => {
  it.each([
    ['45s', 45_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['30d', 2_592_000_000],
  ])('%s → %d ms', (duration, expected) => {
    expect(parseDurationToMs(duration)).toBe(expected);
  });

  it.each(['15', 'm', '1.5h', '10w', ''])('rejects "%s"', (duration) => {
    expect(() => parseDurationToMs(duration)).toThrow(/Invalid duration/);
  });
});
