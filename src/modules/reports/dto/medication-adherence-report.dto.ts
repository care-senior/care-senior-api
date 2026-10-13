export class AdherenceDto {
  /** Doses whose time already passed. */
  due!: number;

  /** Doses registered as completed. */
  taken!: number;

  /** `taken / due`, from 0 to 1; null without doses due. */
  rate!: number | null;
}

export class DailyAdherenceDto extends AdherenceDto {
  /** `YYYY-MM-DD`, Brasília. */
  date!: string;
}

export class MedicationAdherenceReportDto {
  from!: Date;

  to!: Date;

  total!: AdherenceDto;

  /** One point per day of the period. */
  days!: DailyAdherenceDto[];
}
