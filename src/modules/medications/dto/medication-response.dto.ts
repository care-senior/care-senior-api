import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { MedicationForm } from '../../../common/enums/index.js';
import type { Medication } from '../entities/medication.entity.js';

export class MedicationResponseDto {
  id!: string;

  residentId!: string;

  residentName!: string;

  name!: string;

  dosage!: string;

  @ApiProperty({ enum: MedicationForm, enumName: 'MedicationForm' })
  form!: MedicationForm;

  frequency!: string;

  instructions!: string | null;

  prescribedBy!: string | null;

  startDate!: Date;

  /** Null while the treatment is continuous. */
  endDate!: Date | null;

  /** False once the treatment was ended (deactivated). */
  active!: boolean;

  /** `residentName` comes from `medication.resident`, so load that relation first. */
  static fromEntity(medication: Medication): MedicationResponseDto {
    const dto = new MedicationResponseDto();
    dto.id = medication.id;
    dto.residentId = medication.residentId;
    dto.residentName = medication.resident.name;
    dto.name = medication.name;
    dto.dosage = medication.dosage;
    dto.form = medication.form;
    dto.frequency = medication.frequency;
    dto.instructions = medication.instructions ?? null;
    dto.prescribedBy = medication.prescribedBy ?? null;
    dto.startDate = medication.startDate;
    dto.endDate = medication.endDate ?? null;
    dto.active = medication.active;
    return dto;
  }
}

export class MedicationPageDto extends PaginatedResponseDto(
  MedicationResponseDto,
) {}
