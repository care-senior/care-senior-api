import { type EntityManager, In } from 'typeorm';
import { ActivityStatus } from '../../../common/enums/index.js';
import { ActivityParticipant } from '../entities/activity-participant.entity.js';
import { Activity } from '../entities/activity.entity.js';

export const OPEN_STATUSES = [
  ActivityStatus.PENDING,
  ActivityStatus.IN_PROGRESS,
  ActivityStatus.LATE,
];

export const ENDED_TREATMENT_REASON = 'Tratamento encerrado';

export async function cancelDosesAfter(
  manager: EntityManager,
  medicationId: string,
  after: Date,
  registeredByStaffId: string | null,
): Promise<void> {
  const doses = await manager
    .getRepository(Activity)
    .createQueryBuilder('activity')
    .setLock('pessimistic_write')
    .select('activity.id')
    .where('activity.medicationId = :medicationId', { medicationId })
    .andWhere('activity.scheduledTime > :after', { after })
    .getMany();
  if (doses.length === 0) return;

  await manager.update(
    ActivityParticipant,
    {
      activityId: In(doses.map(({ id }) => id)),
      status: In(OPEN_STATUSES),
    },
    {
      status: ActivityStatus.CANCELLED,
      rating: null,
      comment: null,
      notes: ENDED_TREATMENT_REASON,
      statusChangedAt: new Date(),
      registeredByStaffId,
    },
  );
}
