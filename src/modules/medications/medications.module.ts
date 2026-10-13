import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from '../residents/entities/resident.entity.js';
import { ResidentsModule } from '../residents/residents.module.js';
import { MedicationsController } from './controllers/medications.controller.js';
import { Medication } from './entities/medication.entity.js';
import { MedicationsService } from './services/medications.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Medication, Resident]), ResidentsModule],
  controllers: [MedicationsController],
  providers: [MedicationsService],
})
export class MedicationsModule {}
