import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Medication } from '../medications/entities/medication.entity.js';
import { Resident } from '../residents/entities/resident.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ResidentsModule } from '../residents/residents.module.js';
import { ActivitiesController } from './controllers/activities.controller.js';
import { ActivitiesService } from './services/activities.service.js';
import { Activity } from './entities/activity.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Activity, Resident, Medication]),
    ResidentsModule,
    NotificationsModule,
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
})
export class ActivitiesModule {}
