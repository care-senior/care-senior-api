import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ActivityStatus,
  ActivityType,
  NotificationType,
} from '../../../common/enums/index.js';
import { Activity } from '../../activities/entities/activity.entity.js';
import { ActivityReminder } from '../entities/activity-reminder.entity.js';
import { NotifierService } from './notifier.service.js';
import { RemindersService } from './reminders.service.js';

function chainableQuery(result: Record<string, unknown>) {
  const query: Record<string, unknown> = { ...result };
  for (const method of [
    'innerJoinAndSelect',
    'innerJoin',
    'addSelect',
    'where',
    'andWhere',
    'orderBy',
    'insert',
    'values',
    'orIgnore',
    'returning',
  ]) {
    query[method] = vi.fn(() => query);
  }
  return query;
}

describe('RemindersService', () => {
  let service: RemindersService;
  const activityRepository = { createQueryBuilder: vi.fn() };
  const reminderRepository = { createQueryBuilder: vi.fn() };
  const notifier = { notify: vi.fn() };
  const now = new Date('2026-10-13T11:00:00Z');

  const insulin = Object.assign(new Activity(), {
    id: 'activity-1',
    clinicId: 'clinic-1',
    type: ActivityType.MEDICATION,
    title: 'Insulina',
    scheduledTime: new Date('2026-10-13T11:20:00Z'),
    participants: [
      { status: ActivityStatus.PENDING, resident: { name: 'Maria' } },
      { status: ActivityStatus.PENDING, resident: { name: 'José' } },
    ],
  });

  function found(upcoming: Activity[], overdue: Activity[] = []) {
    activityRepository.createQueryBuilder
      .mockReturnValueOnce(
        chainableQuery({ getMany: () => Promise.resolve(upcoming) }),
      )
      .mockReturnValueOnce(
        chainableQuery({ getMany: () => Promise.resolve(overdue) }),
      );
  }

  function claimed(rowWentIn: boolean) {
    reminderRepository.createQueryBuilder.mockReturnValue(
      chainableQuery({
        execute: () =>
          Promise.resolve({ raw: rowWentIn ? [{ activityId: 'x' }] : [] }),
      }),
    );
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: getRepositoryToken(Activity), useValue: activityRepository },
        {
          provide: getRepositoryToken(ActivityReminder),
          useValue: reminderRepository,
        },
        { provide: NotifierService, useValue: notifier },
      ],
    }).compile();
    service = module.get(RemindersService);
  });

  it('reminds the clinic staff of an upcoming dose', async () => {
    found([insulin]);
    claimed(true);

    await service.sendDueReminders(now);

    expect(notifier.notify).toHaveBeenCalledWith(
      {
        type: NotificationType.MEDICATION_UPCOMING,
        title: 'Medicação às 08:20: Insulina',
        message: 'Para José, Maria.',
      },
      { staffOf: { clinicId: 'clinic-1' } },
    );
  });

  it('warns about a dose not registered and other activities about to start', async () => {
    const walk = Object.assign(new Activity(), {
      ...insulin,
      id: 'activity-2',
      type: ActivityType.PHYSICAL_ACTIVITY,
      title: 'Caminhada',
    });
    found([walk], [insulin]);
    claimed(true);

    await service.sendDueReminders(now);

    expect(notifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.UPCOMING_EVENT,
        title: 'Caminhada às 08:20',
      }),
      expect.anything(),
    );
    expect(notifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.MEDICATION_OVERDUE,
        title: 'Medicação atrasada: Insulina',
      }),
      expect.anything(),
    );
  });

  it('sends nothing when the reminder was already claimed', async () => {
    found([insulin]);
    claimed(false);

    await service.sendDueReminders(now);

    expect(notifier.notify).not.toHaveBeenCalled();
  });
});
