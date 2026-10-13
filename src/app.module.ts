import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { ActivitiesModule } from './modules/activities/activities.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ClinicsModule } from './modules/clinics/clinics.module.js';
import { GuardiansModule } from './modules/guardians/guardians.module.js';
import { MedicationsModule } from './modules/medications/medications.module.js';
import { ResidentsModule } from './modules/residents/residents.module.js';
import { RoomsModule } from './modules/rooms/rooms.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { AuthSession } from './modules/auth/entities/auth-session.entity.js';
import { AuthToken } from './modules/auth/entities/auth-token.entity.js';
import { validateEnvironment, type Environment } from './config/environment.js';
import { Clinic } from './modules/clinics/entities/clinic.entity.js';
import { Room } from './modules/rooms/entities/room.entity.js';
import { StaffMember } from './modules/staff/entities/staff-member.entity.js';
import { Guardian } from './modules/guardians/entities/guardian.entity.js';
import { Resident } from './modules/residents/entities/resident.entity.js';
import { OutingRequest } from './modules/outing-requests/entities/outing-request.entity.js';
import { Activity } from './modules/activities/entities/activity.entity.js';
import { ActivityParticipant } from './modules/activities/entities/activity-participant.entity.js';
import { Routine } from './modules/routines/entities/routine.entity.js';
import { Medication } from './modules/medications/entities/medication.entity.js';
import { HealthRecord } from './modules/health-records/entities/health-record.entity.js';
import { Message } from './modules/messages/entities/message.entity.js';
import { UserFeedback } from './modules/feedback/entities/user-feedback.entity.js';
import { AppNotification } from './modules/notifications/entities/app-notification.entity.js';
import { NotificationRecipient } from './modules/notifications/entities/notification-recipient.entity.js';

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
    ActivitiesModule,
    AuthModule,
    ClinicsModule,
    GuardiansModule,
    MedicationsModule,
    ResidentsModule,
    RoomsModule,
    StaffModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
