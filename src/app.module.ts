import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { ClinicsModule } from './clinics/clinics.module.js';
import { GuardiansModule } from './guardians/guardians.module.js';
import { ResidentsModule } from './residents/residents.module.js';
import { StaffModule } from './staff/staff.module.js';
import { AuthSession } from './auth/entities/auth-session.entity.js';
import { AuthToken } from './auth/entities/auth-token.entity.js';
import { validateEnvironment, type Environment } from './config/environment.js';
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
  AuthSession,
  AuthToken,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        type: 'postgres',
        host: config.get('DB_HOST', { infer: true }),
        port: config.get('DB_PORT', { infer: true }),
        username: config.get('DB_USERNAME', { infer: true }),
        password: config.get('DB_PASSWORD', { infer: true }),
        database: config.get('DB_NAME', { infer: true }),
        entities: ENTITIES,
        synchronize: false,
      }),
    }),
    AuthModule,
    ClinicsModule,
    GuardiansModule,
    ResidentsModule,
    StaffModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
