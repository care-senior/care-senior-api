import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from '../activities/entities/activity.entity.js';
import { Guardian } from '../guardians/entities/guardian.entity.js';
import { StaffMember } from '../staff/entities/staff-member.entity.js';
import { NotificationsController } from './controllers/notifications.controller.js';
import { ActivityReminder } from './entities/activity-reminder.entity.js';
import { AppNotification } from './entities/app-notification.entity.js';
import { NotificationRecipient } from './entities/notification-recipient.entity.js';
import { NotificationsService } from './services/notifications.service.js';
import { NotifierService } from './services/notifier.service.js';
import { RemindersService } from './services/reminders.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppNotification,
      NotificationRecipient,
      ActivityReminder,
      Activity,
      Guardian,
      StaffMember,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotifierService, RemindersService],
  exports: [NotifierService],
})
export class NotificationsModule {}
