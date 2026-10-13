import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from '../residents/entities/resident.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ResidentsModule } from '../residents/residents.module.js';
import { OutingRequestsController } from './controllers/outing-requests.controller.js';
import { OutingRequest } from './entities/outing-request.entity.js';
import { OutingRequestsService } from './services/outing-requests.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutingRequest, Resident]),
    ResidentsModule,
    NotificationsModule,
  ],
  controllers: [OutingRequestsController],
  providers: [OutingRequestsService],
})
export class OutingRequestsModule {}
