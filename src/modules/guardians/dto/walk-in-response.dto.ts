import { ResidentResponseDto } from '../../residents/dto/resident-response.dto.js';
import { GuardianResponseDto } from './guardian-response.dto.js';

export class WalkInResponseDto {
  guardian!: GuardianResponseDto;

  resident!: ResidentResponseDto;
}
