import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES_THAT_MANAGE_REQUESTS } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { ActivitiesByTypeReportDto } from '../dto/activities-by-type-report.dto.js';
import { ActivityCompletionReportDto } from '../dto/activity-completion-report.dto.js';
import { FeedbackSummaryReportDto } from '../dto/feedback-summary-report.dto.js';
import { MedicationAdherenceReportDto } from '../dto/medication-adherence-report.dto.js';
import { OccupancyReportDto } from '../dto/occupancy-report.dto.js';
import { OverviewReportDto } from '../dto/overview-report.dto.js';
import {
  ReportPeriodQueryDto,
  ReportQueryDto,
} from '../dto/report-query.dto.js';
import { ReportsService } from '../services/reports.service.js';

/** Reports of your clinic. Periods default to the last 30 days. */
@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** Dashboard numbers, now. */
  @Get('overview')
  overview(
    @Query() query: ReportQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OverviewReportDto> {
    return this.reportsService.overview(query, currentUser);
  }

  @Get('activities-by-type')
  activitiesByType(
    @Query() query: ReportPeriodQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ActivitiesByTypeReportDto> {
    return this.reportsService.activitiesByType(query, currentUser);
  }

  @Get('medication-adherence')
  medicationAdherence(
    @Query() query: ReportPeriodQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MedicationAdherenceReportDto> {
    return this.reportsService.medicationAdherence(query, currentUser);
  }

  @Get('activity-completion')
  activityCompletion(
    @Query() query: ReportPeriodQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ActivityCompletionReportDto> {
    return this.reportsService.activityCompletion(query, currentUser);
  }

  @Get('occupancy')
  occupancy(
    @Query() query: ReportPeriodQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OccupancyReportDto> {
    return this.reportsService.occupancy(query, currentUser);
  }

  /** Same audience as `GET /feedback`. */
  @Get('feedback-summary')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  feedbackSummary(
    @Query() query: ReportPeriodQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<FeedbackSummaryReportDto> {
    return this.reportsService.feedbackSummary(query, currentUser);
  }
}
