import { Expose } from 'class-transformer';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';

export class ClinicResponseDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  address!: string;

  @Expose()
  phone!: string;

  @Expose()
  operatingHours!: string;

  /** Services offered by the clinic, as free text (not the schedule). */
  @Expose()
  activities!: string[];

  @Expose()
  responsiblePeople!: string;

  @Expose()
  whatsappPhone!: string;

  @Expose()
  latitude!: number;

  @Expose()
  longitude!: number;

  @Expose()
  photoPath?: string | null;
}

export class ClinicPageDto extends PaginatedResponseDto(ClinicResponseDto) {}
