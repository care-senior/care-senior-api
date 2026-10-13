import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface.js';
import { maskCpf } from '../../common/utils/cpf.js';
import type { Guardian } from '../entities/guardian.entity.js';

export class GuardianResponseDto {
  id!: string;

  name!: string;

  email!: string;

  /** Only the check digits are visible (`•••.•••.•••-09`). */
  maskedCpf!: string | null;

  photoPath?: string | null;

  /**
   * Clinics this guardian already contacted while looking for one. Only
   * returned to the guardian themself: a clinic must not learn which other
   * clinics the family is talking to.
   */
  contactedClinicIds?: string[];

  static fromEntity(
    guardian: Guardian,
    currentUser: AuthenticatedUser,
  ): GuardianResponseDto {
    const dto = new GuardianResponseDto();
    dto.id = guardian.id;
    dto.name = guardian.name;
    dto.email = guardian.email;
    dto.maskedCpf = maskCpf(guardian.cpf);
    dto.photoPath = guardian.photoPath ?? null;
    if (
      currentUser.role === UserRole.GUARDIAN &&
      currentUser.id === guardian.id
    ) {
      dto.contactedClinicIds = guardian.contactedClinicIds;
    }
    return dto;
  }
}

export class GuardianPageDto extends PaginatedResponseDto(
  GuardianResponseDto,
) {}
