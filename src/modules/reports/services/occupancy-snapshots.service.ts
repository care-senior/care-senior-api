import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { capacitySql, occupiedBedsSql } from '../utils/occupancy.js';
import { toBrasiliaDay } from '../utils/report-days.js';

/**
 * Records the occupancy of every clinic for today. It runs every hour and
 * overwrites today's row, so each past day keeps its last value of the day.
 */
@Injectable()
export class OccupancySnapshotsService {
  private readonly logger = new Logger(OccupancySnapshotsService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_HOUR)
  async recordToday(now = new Date()): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO occupancy_snapshots (clinic_id, day, occupied_beds, capacity)
         SELECT clinic.id, $1::date, ${occupiedBedsSql('clinic.id')}, ${capacitySql('clinic.id')}
         FROM clinics clinic
         ON CONFLICT (clinic_id, day) DO UPDATE
           SET occupied_beds = EXCLUDED.occupied_beds, capacity = EXCLUDED.capacity`,
        [toBrasiliaDay(now)],
      );
    } catch (error) {
      this.logger.error('Recording the occupancy failed', error);
    }
  }
}
