import { Module } from '@nestjs/common';
import { ReportsController } from './controllers/reports.controller.js';
import { OccupancySnapshotsService } from './services/occupancy-snapshots.service.js';
import { ReportsService } from './services/reports.service.js';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, OccupancySnapshotsService],
})
export class ReportsModule {}
