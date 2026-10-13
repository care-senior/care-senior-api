import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { paginate } from '../../../common/dto/paginated-response.dto.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import {
  NotificationPageDto,
  NotificationResponseDto,
} from '../dto/notification-response.dto.js';
import type { QueryNotificationsDto } from '../dto/query-notifications.dto.js';
import { NotificationRecipient } from '../entities/notification-recipient.entity.js';

/** The inbox of the logged-in user. */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationRecipient)
    private readonly recipientRepository: Repository<NotificationRecipient>,
  ) {}

  async findAll(
    query: QueryNotificationsDto,
    currentUser: AuthenticatedUser,
  ): Promise<NotificationPageDto> {
    const queryBuilder = this.recipientRepository
      .createQueryBuilder('recipient')
      .innerJoinAndSelect('recipient.notification', 'notification')
      .where('recipient.userId = :userId', { userId: currentUser.id })
      .andWhere('recipient.userRole = :userRole', {
        userRole: currentUser.role,
      })
      .orderBy('notification.createdAt', 'DESC')
      .addOrderBy('notification.id', 'DESC');
    if (query.unread === true) {
      queryBuilder.andWhere('recipient.readAt IS NULL');
    } else if (query.unread === false) {
      queryBuilder.andWhere('recipient.readAt IS NOT NULL');
    }

    const result = await paginate(queryBuilder, query);
    return {
      ...result,
      data: result.data.map((recipient) =>
        NotificationResponseDto.fromRecipient(recipient),
      ),
    };
  }

  async markRead(
    notificationId: string,
    currentUser: AuthenticatedUser,
  ): Promise<NotificationResponseDto> {
    await this.recipientRepository.update(
      { ...this.ownedBy(currentUser), notificationId, readAt: IsNull() },
      { readAt: new Date() },
    );
    const recipient = await this.recipientRepository.findOne({
      where: { ...this.ownedBy(currentUser), notificationId },
      relations: { notification: true },
    });
    // Someone else's notification answers 404 too, so ids can't be probed.
    if (!recipient) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }
    return NotificationResponseDto.fromRecipient(recipient);
  }

  async markAllRead(currentUser: AuthenticatedUser): Promise<void> {
    await this.recipientRepository.update(
      { ...this.ownedBy(currentUser), readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  private ownedBy({ id, role }: AuthenticatedUser) {
    return { userId: id, userRole: role };
  }
}
