export class DailyOccupancyDto {
  /** `YYYY-MM-DD`, Brasília. */
  date!: string;

  occupiedBeds!: number;

  capacity!: number;

  /** From 0 to 1; null without rooms. */
  rate!: number | null;
}

export class OccupancyReportDto {
  from!: Date;

  to!: Date;

  /**
   * End of each day, recorded since the snapshots started; today is the
   * occupancy now. Days before the first snapshot have no point.
   */
  days!: DailyOccupancyDto[];
}
