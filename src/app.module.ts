import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { Clinic } from './clinics/entities/clinic.entity.js';
import { Room } from './rooms/entities/room.entity.js';
import { StaffMember } from './staff/entities/staff-member.entity.js';
import { Guardian } from './guardians/entities/guardian.entity.js';
import { Resident } from './residents/entities/resident.entity.js';
import { OutingRequest } from './outing-requests/entities/outing-request.entity.js';
import { Activity } from './activities/entities/activity.entity.js';
import { ActivityParticipant } from './activities/entities/activity-participant.entity.js';
import { Routine } from './routines/entities/routine.entity.js';
import { Medication } from './medications/entities/medication.entity.js';
import { HealthRecord } from './health-records/entities/health-record.entity.js';
import { Message } from './messages/entities/message.entity.js';
import { UserFeedback } from './feedback/entities/user-feedback.entity.js';
import { AppNotification } from './notifications/entities/app-notification.entity.js';
import { NotificationRecipient } from './notifications/entities/notification-recipient.entity.js';

const ENTITIES = [
  Clinic,
  Room,
  StaffMember,
  Guardian,
  Resident,
  OutingRequest,
  Activity,
  ActivityParticipant,
  Routine,
  Medication,
  HealthRecord,
  Message,
  UserFeedback,
  AppNotification,
  NotificationRecipient,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.getOrThrow<string>('DB_USERNAME'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: ENTITIES,
        // Schema real vem de scripts SQL versionados (agente DBA), nunca de sync automático.
        synchronize: false,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
