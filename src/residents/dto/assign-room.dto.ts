import { IsUUID } from 'class-validator';

export class AssignRoomDto {
  /** A room of the caller clinic with a free bed. */
  @IsUUID()
  roomId!: string;
}
