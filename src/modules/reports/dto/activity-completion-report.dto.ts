export class ActivityCompletionReportDto {
  from!: Date;

  to!: Date;

  /** Participations whose time already passed, except cancelled ones. */
  total!: number;

  completed!: number;

  skipped!: number;

  /** Still pending after the scheduled time. */
  late!: number;

  /** Started and not finished yet. */
  inProgress!: number;

  /** Each count over `total`, from 0 to 1; null when `total` is 0. */
  completedRate!: number | null;

  skippedRate!: number | null;

  lateRate!: number | null;

  inProgressRate!: number | null;
}
