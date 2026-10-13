import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type {
  NotificationType,
  StaffRole,
} from '../../../common/enums/index.js';
import { UserRole } from '../../../common/enums/index.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import { StaffMember } from '../../staff/entities/staff-member.entity.js';
import { AppNotification } from '../entities/app-notification.entity.js';
import { NotificationRecipient } from '../entities/notification-recipient.entity.js';

export interface NotificationContent {
  type: NotificationType;
  title: string;
  message: string;
}

/** Who gets a notification; the parts are added together. */
export interface Audience {
  guardiansOf?: string;
  staffOf?: { clinicId: string; staffRoles?: StaffRole[] };
  /** Usually whoever triggered the event. */
  except?: string;
}

interface Recipient {
  userId: string;
  userRole: UserRole;
}

/** Creates notifications for the other modules; the inbox is NotificationsService. */
@Injectable()
export class NotifierService {
  private readonly logger = new Logger(NotifierService.name);

  constructor(
    @InjectRepository(Guardian)
    private readonly guardianRepository: Repository<Guardian>,
    @InjectRepository(StaffMember)
    private readonly staffRepository: Repository<StaffMember>,
    private readonly dataSource: DataSource,
  ) {}

  // The action that triggered the notification already happened, so a
  // failure here is logged instead of failing the request.
  async notify(content: NotificationContent, audience: Audience) {
    try {
      const recipients = (await this.resolve(audience)).filter(
        ({ userId }) => userId !== audience.except,
      );
      if (recipients.length === 0) return;

      await this.dataSource.transaction(async (manager) => {
        const notification = await manager.save(
          manager.create(AppNotification, content),
        );
        await manager.insert(
          NotificationRecipient,
          recipients.map((recipient) => ({
            ...recipient,
            notificationId: notification.id,
          })),
        );
      });
    } catch (error) {
      this.logger.error(`Notification "${content.type}" failed`, error);
    }
  }

  private async resolve({
    guardiansOf,
    staffOf,
  }: Audience): Promise<Recipient[]> {
    const recipients = new Map<string, Recipient>();
    if (guardiansOf) {
      const guardians = await this.guardianRepository
        .createQueryBuilder('guardian')
        .select('guardian.id')
        .innerJoin('guardian.residents', 'resident', 'resident.id = :id', {
          id: guardiansOf,
        })
        .getMany();
      for (const { id } of guardians) {
        recipients.set(id, { userId: id, userRole: UserRole.GUARDIAN });
      }
    }
    if (staffOf) {
      const staffQuery = this.staffRepository
        .createQueryBuilder('staff')
        .select('staff.id')
        .where('staff.clinicId = :clinicId', { clinicId: staffOf.clinicId })
        .andWhere('staff.deactivatedAt IS NULL');
      if (staffOf.staffRoles) {
        staffQuery.andWhere('staff.staffRole IN (:...staffRoles)', {
          staffRoles: staffOf.staffRoles,
        });
      }
      for (const { id } of await staffQuery.getMany()) {
        recipients.set(id, { userId: id, userRole: UserRole.STAFF });
      }
    }
    return [...recipients.values()];
  }
}
