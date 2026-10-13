import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from '../residents/entities/resident.entity.js';
import { ActivitiesController } from './controllers/activities.controller.js';
import { ActivitiesService } from './services/activities.service.js';
import { Activity } from './entities/activity.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, Resident])],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
})
export class ActivitiesModule {}
