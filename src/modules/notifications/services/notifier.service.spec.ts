import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  NotificationType,
  StaffRole,
  UserRole,
} from '../../../common/enums/index.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import { StaffMember } from '../../staff/entities/staff-member.entity.js';
import { NotificationRecipient } from '../entities/notification-recipient.entity.js';
import { NotifierService } from './notifier.service.js';

function queryReturning(ids: string[]) {
  const query: Record<string, unknown> = {
    getMany: vi.fn(() => Promise.resolve(ids.map((id) => ({ id })))),
  };
  for (const method of ['select', 'innerJoin', 'where', 'andWhere']) {
    query[method] = vi.fn(() => query);
  }
  return query;
}

describe('NotifierService', () => {
  let service: NotifierService;
  const guardianRepository = { createQueryBuilder: vi.fn() };
  const staffRepository = { createQueryBuilder: vi.fn() };
  const manager = {
    create: vi.fn((_entity: unknown, data: object) => data),
    save: vi.fn((data: object) =>
      Promise.resolve({ id: 'notification-1', ...data }),
    ),
    insert: vi.fn(),
  };
  const dataSource = {
    transaction: vi.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  };
  const content = {
    type: NotificationType.GENERAL,
    title: 'Novo recado sobre Maria',
    message: 'Fernanda: tudo bem?',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotifierService,
        { provide: getRepositoryToken(Guardian), useValue: guardianRepository },
        { provide: getRepositoryToken(StaffMember), useValue: staffRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(NotifierService);
  });

  it('delivers one notification to the family and the staff, except the sender', async () => {
    guardianRepository.createQueryBuilder.mockReturnValue(
      queryReturning(['guardian-1', 'guardian-2']),
    );
    const staffQuery = queryReturning(['staff-1']);
    staffRepository.createQueryBuilder.mockReturnValue(staffQuery);

    await service.notify(content, {
      guardiansOf: 'resident-1',
      staffOf: {
        clinicId: 'clinic-1',
        staffRoles: [StaffRole.COORDINATOR],
      },
      except: 'guardian-1',
    });

    expect(staffQuery.andWhere).toHaveBeenCalledWith(
      'staff.staffRole IN (:...staffRoles)',
      { staffRoles: [StaffRole.COORDINATOR] },
    );
    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(manager.insert).toHaveBeenCalledWith(NotificationRecipient, [
      {
        userId: 'guardian-2',
        userRole: UserRole.GUARDIAN,
        notificationId: 'notification-1',
      },
      {
        userId: 'staff-1',
        userRole: UserRole.STAFF,
        notificationId: 'notification-1',
      },
    ]);
  });

  it('creates nothing when no one is left to notify', async () => {
    guardianRepository.createQueryBuilder.mockReturnValue(
      queryReturning(['guardian-1']),
    );

    await service.notify(content, {
      guardiansOf: 'resident-1',
      except: 'guardian-1',
    });

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('logs a failure instead of failing the action that triggered it', async () => {
    const logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    guardianRepository.createQueryBuilder.mockImplementation(() => {
      throw new Error('connection lost');
    });

    await expect(
      service.notify(content, { guardiansOf: 'resident-1' }),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalled();
    logError.mockRestore();
  });
});
