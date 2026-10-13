import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import {
  NotificationPageDto,
  NotificationResponseDto,
} from '../dto/notification-response.dto.js';
import { QueryNotificationsDto } from '../dto/query-notifications.dto.js';
import { NotificationsService } from '../services/notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** Inbox of the logged-in user, newest first. */
  @Get()
  findAll(
    @Query() query: QueryNotificationsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<NotificationPageDto> {
    return this.notificationsService.findAll(query, currentUser);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@CurrentUser() currentUser: AuthenticatedUser): Promise<void> {
    return this.notificationsService.markAllRead(currentUser);
  }

  @Patch(':id/read')
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markRead(id, currentUser);
  }
}
