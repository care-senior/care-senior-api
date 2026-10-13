export class RatingCountDto {
  /** 1 to 5. */
  rating!: number;

  count!: number;
}

export class FeedbackSummaryReportDto {
  from!: Date;

  to!: Date;

  /** Feedback the clinic received in the period. */
  total!: number;

  /** Rounded to 2 places; null without feedback. */
  average!: number | null;

  /** Ratings 1 to 5, also the ones nobody gave. */
  histogram!: RatingCountDto[];
}
