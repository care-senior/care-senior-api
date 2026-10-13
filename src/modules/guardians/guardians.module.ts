import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Clinic } from '../clinics/entities/clinic.entity.js';
import { Resident } from '../residents/entities/resident.entity.js';
import { Guardian } from './entities/guardian.entity.js';
import { GuardiansController } from './controllers/guardians.controller.js';
import { GuardiansService } from './services/guardians.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Guardian, Resident, Clinic]), AuthModule],
  controllers: [GuardiansController],
  providers: [GuardiansService],
})
export class GuardiansModule {}
