import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ActivityStatus,
  ActivityType,
  OutingRequestStatus,
  UserRole,
} from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import type { ActivitiesByTypeReportDto } from '../dto/activities-by-type-report.dto.js';
import type { ActivityCompletionReportDto } from '../dto/activity-completion-report.dto.js';
import type { FeedbackSummaryReportDto } from '../dto/feedback-summary-report.dto.js';
import type { MedicationAdherenceReportDto } from '../dto/medication-adherence-report.dto.js';
import type { OccupancyReportDto } from '../dto/occupancy-report.dto.js';
import type { OverviewReportDto } from '../dto/overview-report.dto.js';
import type {
  ReportPeriodQueryDto,
  ReportQueryDto,
} from '../dto/report-query.dto.js';
import { capacitySql, occupiedBedsSql } from '../utils/occupancy.js';
import {
  brasiliaDay,
  daysBetween,
  rate,
  toBrasiliaDay,
} from '../utils/report-days.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_PERIOD_DAYS = 30;
export const MAX_PERIOD_DAYS = 366;

interface Period {
  clinicId: string;
  from: Date;
  to: Date;
}

/** Read-only aggregations over the clinic of the caller. */
@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  async overview(
    query: ReportQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<OverviewReportDto> {
    const clinicId = this.clinicOf(query, currentUser);
    const [row] = (await this.dataSource.query(
      `SELECT
         (SELECT count(*)::int FROM residents WHERE clinic_id = $1::uuid) AS "activeResidents",
         (SELECT count(*)::int FROM staff_members
          WHERE clinic_id = $1 AND deactivated_at IS NULL) AS "activeStaff",
         ${occupiedBedsSql('$1')} AS "occupiedBeds",
         ${capacitySql('$1')} AS "capacity",
         (SELECT count(*)::int FROM guardians guardian
          WHERE $1::text = ANY(guardian.contacted_clinic_ids)
            AND EXISTS (
              SELECT 1 FROM guardian_resident link
              JOIN residents unlinked ON unlinked.id = link.resident_id
              WHERE link.guardian_id = guardian.id AND unlinked.clinic_id IS NULL
            )) AS "pendingLinkRequests",
         (SELECT count(*)::int FROM outing_requests outing
          JOIN residents resident ON resident.id = outing.resident_id
          WHERE resident.clinic_id = $1 AND outing.status = $2) AS "pendingOutingRequests"`,
      [clinicId, OutingRequestStatus.PENDING],
    )) as Omit<OverviewReportDto, 'occupancyRate'>[];
    return { ...row!, occupancyRate: rate(row!.occupiedBeds, row!.capacity) };
  }

  async activitiesByType(
    query: ReportPeriodQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<ActivitiesByTypeReportDto> {
    const { clinicId, from, to } = this.periodOf(query, currentUser);
    const rows = (await this.dataSource.query(
      `SELECT type, count(*)::int AS count FROM activities
       WHERE clinic_id = $1 AND scheduled_time BETWEEN $2 AND $3
       GROUP BY type`,
      [clinicId, from, to],
    )) as { type: ActivityType; count: number }[];
    return {
      from,
      to,
      types: Object.values(ActivityType).map((type) => ({
        type,
        count: rows.find((row) => row.type === type)?.count ?? 0,
      })),
    };
  }

  // A dose counts once its time passed: future doses are not missed yet.
  async medicationAdherence(
    query: ReportPeriodQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<MedicationAdherenceReportDto> {
    const { clinicId, from, to } = this.periodOf(query, currentUser);
    const rows = (await this.dataSource.query(
      `SELECT ${brasiliaDay('activity.scheduled_time')} AS date,
              count(*)::int AS due,
              count(*) FILTER (WHERE participant.status = $5)::int AS taken
       FROM activity_participants participant
       JOIN activities activity ON activity.id = participant.activity_id
       WHERE activity.clinic_id = $1 AND activity.type = $4
         AND activity.scheduled_time BETWEEN $2 AND $3
         AND participant.status <> $6
       GROUP BY 1`,
      [
        clinicId,
        from,
        earliest(to, new Date()),
        ActivityType.MEDICATION,
        ActivityStatus.COMPLETED,
        ActivityStatus.CANCELLED,
      ],
    )) as { date: string; due: number; taken: number }[];

    const days = daysBetween(from, to).map((date) => {
      const { due = 0, taken = 0 } =
        rows.find((row) => row.date === date) ?? {};
      return { date, due, taken, rate: rate(taken, due) };
    });
    const due = sum(days.map((day) => day.due));
    const taken = sum(days.map((day) => day.taken));
    return { from, to, total: { due, taken, rate: rate(taken, due) }, days };
  }

  async activityCompletion(
    query: ReportPeriodQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<ActivityCompletionReportDto> {
    const { clinicId, from, to } = this.periodOf(query, currentUser);
    const rows = (await this.dataSource.query(
      `SELECT participant.status, count(*)::int AS count
       FROM activity_participants participant
       JOIN activities activity ON activity.id = participant.activity_id
       WHERE activity.clinic_id = $1
         AND activity.scheduled_time BETWEEN $2 AND $3
         AND participant.status <> $4
       GROUP BY participant.status`,
      [clinicId, from, earliest(to, new Date()), ActivityStatus.CANCELLED],
    )) as { status: ActivityStatus; count: number }[];
    const countOf = (status: ActivityStatus) =>
      rows.find((row) => row.status === status)?.count ?? 0;

    const completed = countOf(ActivityStatus.COMPLETED);
    const skipped = countOf(ActivityStatus.SKIPPED);
    const late = countOf(ActivityStatus.PENDING);
    const inProgress = countOf(ActivityStatus.IN_PROGRESS);
    const total = completed + skipped + late + inProgress;
    return {
      from,
      to,
      total,
      completed,
      skipped,
      late,
      inProgress,
      completedRate: rate(completed, total),
      skippedRate: rate(skipped, total),
      lateRate: rate(late, total),
      inProgressRate: rate(inProgress, total),
    };
  }

  async occupancy(
    query: ReportPeriodQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<OccupancyReportDto> {
    const { clinicId, from, to } = this.periodOf(query, currentUser);
    const today = toBrasiliaDay(new Date());
    const rows = (await this.dataSource.query(
      `SELECT day::text AS date, occupied_beds AS "occupiedBeds", capacity
       FROM occupancy_snapshots
       WHERE clinic_id = $1::uuid AND day BETWEEN $2::date AND $3::date AND day <> $4::date
       UNION ALL
       SELECT $4::text, ${occupiedBedsSql('$1')}, ${capacitySql('$1')}
       WHERE $4::date BETWEEN $2::date AND $3::date
       ORDER BY 1`,
      [clinicId, toBrasiliaDay(from), toBrasiliaDay(to), today],
    )) as { date: string; occupiedBeds: number; capacity: number }[];
    return {
      from,
      to,
      days: rows.map((row) => ({
        ...row,
        rate: rate(row.occupiedBeds, row.capacity),
      })),
    };
  }

  async feedbackSummary(
    query: ReportPeriodQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<FeedbackSummaryReportDto> {
    const { clinicId, from, to } = this.periodOf(query, currentUser);
    const rows = (await this.dataSource.query(
      `SELECT rating, count(*)::int AS count FROM user_feedback
       WHERE $1 = ANY(clinic_ids) AND sent_at BETWEEN $2 AND $3
       GROUP BY rating`,
      [clinicId, from, to],
    )) as { rating: number; count: number }[];
    const histogram = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: rows.find((row) => row.rating === rating)?.count ?? 0,
    }));
    const total = sum(histogram.map(({ count }) => count));
    const points = sum(histogram.map(({ rating, count }) => rating * count));
    return {
      from,
      to,
      total,
      average: total === 0 ? null : Math.round((points / total) * 100) / 100,
      histogram,
    };
  }

  private periodOf(
    query: ReportPeriodQueryDto,
    currentUser: AuthenticatedUser,
  ): Period {
    const clinicId = this.clinicOf(query, currentUser);
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_PERIOD_DAYS * DAY_MS);
    if (from >= to) {
      throw new BadRequestException('to must be after from');
    }
    if (to.getTime() - from.getTime() > MAX_PERIOD_DAYS * DAY_MS) {
      throw new BadRequestException(
        `The period can have at most ${MAX_PERIOD_DAYS} days`,
      );
    }
    return { clinicId, from, to };
  }

  private clinicOf(
    { clinicId }: ReportQueryDto,
    currentUser: AuthenticatedUser,
  ): string {
    if (currentUser.role !== UserRole.STAFF || !currentUser.clinicId) {
      throw new ForbiddenException('Only staff members can see reports');
    }
    if (clinicId && clinicId !== currentUser.clinicId) {
      throw new ForbiddenException(
        'Staff can only see the reports of their own clinic',
      );
    }
    return currentUser.clinicId;
  }
}

function earliest(first: Date, second: Date): Date {
  return first < second ? first : second;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
