import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutinesController } from './controllers/routines.controller.js';
import { Routine } from './entities/routine.entity.js';
import { RoutineActivitiesService } from './services/routine-activities.service.js';
import { RoutinesService } from './services/routines.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Routine])],
  controllers: [RoutinesController],
  providers: [RoutinesService, RoutineActivitiesService],
})
export class RoutinesModule {}
