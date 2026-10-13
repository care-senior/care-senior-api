import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guardian } from '../guardians/entities/guardian.entity.js';
import { Resident } from '../residents/entities/resident.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ResidentsModule } from '../residents/residents.module.js';
import { StaffMember } from '../staff/entities/staff-member.entity.js';
import { MessagesController } from './controllers/messages.controller.js';
import { Message } from './entities/message.entity.js';
import { MessagesService } from './services/messages.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Resident, StaffMember, Guardian]),
    ResidentsModule,
    NotificationsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
