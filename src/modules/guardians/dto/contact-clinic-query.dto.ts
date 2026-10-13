import { IsUUID } from 'class-validator';

export class ContactClinicQueryDto {
  @IsUUID()
  clinicId!: string;
}
