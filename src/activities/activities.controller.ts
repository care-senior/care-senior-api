import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import { ActivitiesService } from './activities.service.js';
import {
  ActivityPageDto,
  ActivityResponseDto,
} from './dto/activity-response.dto.js';
import { CreateActivityDto } from './dto/create-activity.dto.js';
import {
  CompleteParticipantDto,
  CompleteParticipantsDto,
  SkipParticipantDto,
  SkipParticipantsDto,
} from './dto/participant-outcome.dto.js';
import { QueryActivitiesDto } from './dto/query-activities.dto.js';
import { UpdateActivityDto } from './dto/update-activity.dto.js';

@ApiTags('Activities')
@ApiBearerAuth()
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  findAll(
    @Query() query: QueryActivitiesDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ActivityPageDto> {
    return this.activitiesService.findAll(query, currentUser);
  }

  @Post()
  create(
    @Body() dto: CreateActivityDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.activitiesService.create(dto, currentUser);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.activitiesService.findOne(id, currentUser);
  }

  /** Only while no participant has started. */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.activitiesService.update(id, dto, currentUser);
  }

  /** Starts every participant not started yet. */
  @Post(':id/start-all')
  @HttpCode(HttpStatus.OK)
  startAll(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.activitiesService.startAll(id, currentUser);
  }

  @Post(':id/participants/:residentId/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @Body() dto: CompleteParticipantDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.activitiesService.complete(id, residentId, dto, currentUser);
  }

  @Post(':id/participants/:residentId/skip')
  @HttpCode(HttpStatus.OK)
  skip(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @Body() dto: SkipParticipantDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.activitiesService.skip(id, residentId, dto, currentUser);
  }

  /** All or nothing: one resident that can't be completed fails the batch. */
  @Post(':id/complete-batch')
  @HttpCode(HttpStatus.OK)
  completeBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteParticipantsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.activitiesService.completeBatch(id, dto, currentUser);
  }

  /** All or nothing: one resident that can't be skipped fails the batch. */
  @Post(':id/skip-batch')
  @HttpCode(HttpStatus.OK)
  skipBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SkipParticipantsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.activitiesService.skipBatch(id, dto, currentUser);
  }
}
