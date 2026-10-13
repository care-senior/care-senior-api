import { ApiProperty } from '@nestjs/swagger';
import { ActivityType } from '../../../common/enums/index.js';

export class ActivityTypeCountDto {
  @ApiProperty({ enum: ActivityType, enumName: 'ActivityType' })
  type!: ActivityType;

  /** Activities scheduled in the period. */
  count!: number;
}

export class ActivitiesByTypeReportDto {
  from!: Date;

  to!: Date;

  /** Every type, also the ones with no activity, in the enum order. */
  types!: ActivityTypeCountDto[];
}
