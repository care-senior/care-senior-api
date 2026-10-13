import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Guardian } from '../guardians/entities/guardian.entity.js';
import { Resident } from './entities/resident.entity.js';
import { ResidentsController } from './residents.controller.js';
import { ResidentsService } from './residents.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Resident, Guardian]), AuthModule],
  controllers: [ResidentsController],
  providers: [ResidentsService],
})
export class ResidentsModule {}
