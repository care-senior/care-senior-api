import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import {
  ActivityStatus,
  ActivityType,
  UserRole,
} from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import type { ActivityParticipant } from '../entities/activity-participant.entity.js';
import type { Activity } from '../entities/activity.entity.js';

export class RegisteredByDto {
  id!: string;

  name!: string;
}

export class ActivityParticipantResponseDto {
  residentId!: string;

  residentName!: string;

  /** `late` is never stored: a pending participant becomes late once the scheduled time passes. */
  @ApiProperty({ enum: ActivityStatus, enumName: 'ActivityStatus' })
  status!: ActivityStatus;

  statusChangedAt!: Date | null;

  /** Why it was skipped. */
  notes!: string | null;

  rating!: number | null;

  comment!: string | null;

  /** Staff member who registered the current status. Never sent to guardians. */
  registeredBy?: RegisteredByDto | null;

  /** `resident` and `registeredBy` come from relations, so load them first. */
  static fromEntity(
    participant: ActivityParticipant,
    scheduledTime: Date,
    currentUser: AuthenticatedUser,
    now: Date,
  ): ActivityParticipantResponseDto {
    const dto = new ActivityParticipantResponseDto();
    dto.residentId = participant.residentId;
    dto.residentName = participant.resident.name;
    dto.status =
      participant.status === ActivityStatus.PENDING && scheduledTime < now
        ? ActivityStatus.LATE
        : participant.status;
    dto.statusChangedAt = participant.statusChangedAt ?? null;
    dto.notes = participant.notes ?? null;
    dto.rating = participant.rating ?? null;
    dto.comment = participant.comment ?? null;
    if (currentUser.role === UserRole.STAFF) {
      dto.registeredBy = participant.registeredBy
        ? {
            id: participant.registeredBy.id,
            name: participant.registeredBy.name,
          }
        : null;
    }
    return dto;
  }
}

export class ActivityResponseDto {
  id!: string;

  clinicId!: string;

  @ApiProperty({ enum: ActivityType, enumName: 'ActivityType' })
  type!: ActivityType;

  title!: string;

  scheduledTime!: Date;

  detail!: string | null;

  photoPath!: string | null;

  medicationId!: string | null;

  routineId!: string | null;

  /** By resident name. A guardian only gets the participants who are their residents. */
  participants!: ActivityParticipantResponseDto[];

  static fromEntity(
    activity: Activity,
    currentUser: AuthenticatedUser,
    now = new Date(),
  ): ActivityResponseDto {
    const dto = new ActivityResponseDto();
    dto.id = activity.id;
    dto.clinicId = activity.clinicId;
    dto.type = activity.type;
    dto.title = activity.title;
    dto.scheduledTime = activity.scheduledTime;
    dto.detail = activity.detail ?? null;
    dto.photoPath = activity.photoPath ?? null;
    dto.medicationId = activity.medicationId ?? null;
    dto.routineId = activity.routineId ?? null;
    dto.participants = activity.participants
      .map((participant) =>
        ActivityParticipantResponseDto.fromEntity(
          participant,
          activity.scheduledTime,
          currentUser,
          now,
        ),
      )
      .sort((first, second) =>
        first.residentName.localeCompare(second.residentName),
      );
    return dto;
  }
}

export class ActivityPageDto extends PaginatedResponseDto(
  ActivityResponseDto,
) {}
