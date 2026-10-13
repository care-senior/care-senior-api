import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectOutingRequestDto {
  /** Visible to the guardians. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
