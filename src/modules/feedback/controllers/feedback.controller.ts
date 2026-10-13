import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES_THAT_MANAGE_REQUESTS } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { CreateFeedbackDto } from '../dto/create-feedback.dto.js';
import {
  FeedbackPageDto,
  FeedbackResponseDto,
} from '../dto/feedback-response.dto.js';
import { QueryFeedbackDto } from '../dto/query-feedback.dto.js';
import { FeedbackService } from '../services/feedback.service.js';

@ApiTags('Feedback')
@ApiBearerAuth()
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /** Feedback sent by the staff and the families of the clinic, newest first. */
  @Get()
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  findAll(
    @Query() query: QueryFeedbackDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<FeedbackPageDto> {
    return this.feedbackService.findAll(query, currentUser);
  }

  @Post()
  create(
    @Body() dto: CreateFeedbackDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<FeedbackResponseDto> {
    return this.feedbackService.create(dto, currentUser);
  }
}
