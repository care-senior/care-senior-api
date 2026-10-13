import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import type { Resident } from '../entities/resident.entity.js';

/** Who may see or change a resident and the data that hangs from them. */
@Injectable()
export class ResidentAccessService {
  constructor(
    @InjectRepository(Guardian)
    private readonly guardianRepository: Repository<Guardian>,
  ) {}

  // A clinic sees an unlinked resident once one of their guardians contacted
  // it: that contact is the pending link request.
  async assertCanView(resident: Resident, currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.GUARDIAN) {
      await this.assertIsGuardianOf(resident.id, currentUser.id);
      return;
    }
    const clinicId = this.ownClinicId(currentUser);
    const isRelated =
      resident.clinicId === clinicId ||
      (!resident.clinicId &&
        (await this.hasPendingLinkRequest(resident.id, clinicId)));
    if (!isRelated) {
      throw new ForbiddenException('Resident is not related to your clinic');
    }
  }

  // The guardian fills in the profile until a clinic links the resident;
  // from then on the clinic staff keeps it.
  async assertCanEditProfile(
    resident: Resident,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.role === UserRole.GUARDIAN) {
      await this.assertIsGuardianOf(resident.id, currentUser.id);
      if (resident.clinicId) {
        throw new ForbiddenException(
          'The clinic keeps the profile of a linked resident',
        );
      }
      return;
    }
    this.assertLinkedTo(resident, this.ownClinicId(currentUser));
  }

  async assertIsGuardianOf(residentId: string, guardianId: string) {
    const isGuardian = await this.guardianRepository
      .createQueryBuilder('guardian')
      .innerJoin(
        'guardian.residents',
        'resident',
        'resident.id = :residentId',
        {
          residentId,
        },
      )
      .where('guardian.id = :guardianId', { guardianId })
      .getExists();
    if (!isGuardian) {
      throw new ForbiddenException('Resident belongs to another guardian');
    }
  }

  hasPendingLinkRequest(
    residentId: string,
    clinicId: string,
    manager: EntityManager = this.guardianRepository.manager,
  ): Promise<boolean> {
    return manager
      .getRepository(Guardian)
      .createQueryBuilder('guardian')
      .innerJoin(
        'guardian.residents',
        'resident',
        'resident.id = :residentId',
        {
          residentId,
        },
      )
      .where(':clinicId = ANY(guardian.contactedClinicIds)', { clinicId })
      .getExists();
  }

  assertLinkedTo(resident: Resident, clinicId: string) {
    if (resident.clinicId !== clinicId) {
      throw new ForbiddenException('Resident is not linked to your clinic');
    }
  }

  private ownClinicId(currentUser: AuthenticatedUser): string {
    if (currentUser.role !== UserRole.STAFF || !currentUser.clinicId) {
      throw new ForbiddenException('Only staff members can do this');
    }
    return currentUser.clinicId;
  }
}
