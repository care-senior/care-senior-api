import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { UserRole } from '../../../common/enums/index.js';

export class FeedbackResponseDto {
  @Expose()
  id!: string;

  /** StaffMember or Guardian id, depending on `authorRole`. */
  @Expose()
  authorId!: string;

  /** Name of the author when the feedback was sent. */
  @Expose()
  authorName!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  @Expose()
  authorRole!: UserRole;

  @Expose()
  rating!: number;

  @Expose()
  message!: string;

  @Expose()
  sentAt!: Date;
}

export class FeedbackPageDto extends PaginatedResponseDto(
  FeedbackResponseDto,
) {}
