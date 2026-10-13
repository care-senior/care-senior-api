import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { UserRole } from '../../../common/enums/index.js';

export class MessageResponseDto {
  @Expose()
  id!: string;

  @Expose()
  residentId!: string;

  /** StaffMember or Guardian id, depending on `senderRole`. */
  @Expose()
  senderId!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  @Expose()
  senderRole!: UserRole;

  /** Name of the sender when the message was sent. */
  @Expose()
  senderName!: string;

  @Expose()
  text!: string;

  @Expose()
  sentAt!: Date;
}

export class MessagePageDto extends PaginatedResponseDto(MessageResponseDto) {}
