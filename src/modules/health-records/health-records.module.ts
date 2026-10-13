import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from '../residents/entities/resident.entity.js';
import { ResidentsModule } from '../residents/residents.module.js';
import { HealthRecordsController } from './controllers/health-records.controller.js';
import { HealthRecord } from './entities/health-record.entity.js';
import { HealthRecordsService } from './services/health-records.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([HealthRecord, Resident]),
    ResidentsModule,
  ],
  controllers: [HealthRecordsController],
  providers: [HealthRecordsService],
})
export class HealthRecordsModule {}
