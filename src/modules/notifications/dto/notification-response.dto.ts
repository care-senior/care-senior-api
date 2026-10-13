import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { NotificationType } from '../../../common/enums/index.js';
import type { NotificationRecipient } from '../entities/notification-recipient.entity.js';

export class NotificationResponseDto {
  id!: string;

  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type!: NotificationType;

  title!: string;

  message!: string;

  createdAt!: Date;

  /** When the logged-in user read it; null while unread. */
  readAt!: Date | null;

  /** `notification` comes from a relation, so load it first. */
  static fromRecipient(
    recipient: NotificationRecipient,
  ): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = recipient.notification.id;
    dto.type = recipient.notification.type;
    dto.title = recipient.notification.title;
    dto.message = recipient.notification.message;
    dto.createdAt = recipient.notification.createdAt;
    dto.readAt = recipient.readAt ?? null;
    return dto;
  }
}

export class NotificationPageDto extends PaginatedResponseDto(
  NotificationResponseDto,
) {}
