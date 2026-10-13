import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  residentId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text!: string;
}
