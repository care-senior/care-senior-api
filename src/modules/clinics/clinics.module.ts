import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicsController } from './controllers/clinics.controller.js';
import { ClinicsService } from './services/clinics.service.js';
import { Clinic } from './entities/clinic.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic])],
  controllers: [ClinicsController],
  providers: [ClinicsService],
})
export class ClinicsModule {}
