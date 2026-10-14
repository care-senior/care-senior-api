import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { cancelDosesAfter } from '../../activities/utils/medication-doses.js';
import { paginate } from '../../../common/dto/paginated-response.dto.js';
import { UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { ResidentAccessService } from '../../residents/services/resident-access.service.js';
import type { CreateMedicationDto } from '../dto/create-medication.dto.js';
import {
  MedicationPageDto,
  MedicationResponseDto,
} from '../dto/medication-response.dto.js';
import type { QueryMedicationsDto } from '../dto/query-medications.dto.js';
import type { UpdateMedicationDto } from '../dto/update-medication.dto.js';
import { Medication } from '../entities/medication.entity.js';

@Injectable()
export class MedicationsService {
  constructor(
    @InjectRepository(Medication)
    private readonly medicationRepository: Repository<Medication>,
    @InjectRepository(Resident)
    private readonly residentRepository: Repository<Resident>,
    private readonly residentAccess: ResidentAccessService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: QueryMedicationsDto,
    currentUser: AuthenticatedUser,
  ): Promise<MedicationPageDto> {
    const queryBuilder = this.medicationRepository
      .createQueryBuilder('medication')
      .innerJoin('medication.resident', 'resident')
      .addSelect(['resident.id', 'resident.name'])
      .orderBy('medication.active', 'DESC')
      .addOrderBy('medication.name', 'ASC')
      .addOrderBy('medication.id', 'ASC');

    if (query.residentId) {
      await this.residentAccess.assertCanView(
        await this.findResidentOrThrow(query.residentId),
        currentUser,
      );
      queryBuilder.andWhere('medication.residentId = :residentId', {
        residentId: query.residentId,
      });
    } else if (currentUser.role === UserRole.GUARDIAN) {
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1 FROM guardian_resident link
          WHERE link.resident_id = medication.resident_id
            AND link.guardian_id = :guardianId
        )`,
        { guardianId: currentUser.id },
      );
    } else {
      queryBuilder.andWhere('resident.clinicId = :ownClinicId', {
        ownClinicId: this.ownClinicId(currentUser),
      });
    }

    if (query.clinicId) {
      if (
        currentUser.role === UserRole.STAFF &&
        query.clinicId !== currentUser.clinicId
      ) {
        throw new ForbiddenException(
          'Staff can only list medications of their own clinic',
        );
      }
      queryBuilder.andWhere('resident.clinicId = :clinicId', {
        clinicId: query.clinicId,
      });
    }
    if (query.active !== undefined) {
      queryBuilder.andWhere('medication.active = :active', {
        active: query.active,
      });
    }

    const result = await paginate(queryBuilder, query);
    return {
      ...result,
      data: result.data.map((medication) =>
        MedicationResponseDto.fromEntity(medication),
      ),
    };
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<MedicationResponseDto> {
    const medication = await this.findOrThrow(id);
    await this.residentAccess.assertCanView(medication.resident, currentUser);
    return MedicationResponseDto.fromEntity(medication);
  }

  async create(
    { residentId, startDate, endDate, ...fields }: CreateMedicationDto,
    currentUser: AuthenticatedUser,
  ): Promise<MedicationResponseDto> {
    const resident = await this.findResidentOrThrow(residentId);
    await this.residentAccess.assertCanEditProfile(resident, currentUser);

    const medication = this.medicationRepository.create({
      ...fields,
      residentId,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      active: true,
    });
    assertValidPeriod(medication);
    const saved = await this.medicationRepository.save(medication);
    return MedicationResponseDto.fromEntity({ ...saved, resident });
  }

  async update(
    id: string,
    { startDate, endDate, ...fields }: UpdateMedicationDto,
    currentUser: AuthenticatedUser,
  ): Promise<MedicationResponseDto> {
    const medication = await this.findEditableOrThrow(id, currentUser);
    this.medicationRepository.merge(medication, fields);
    if (startDate) medication.startDate = new Date(startDate);
    if (endDate !== undefined) {
      medication.endDate = endDate ? new Date(endDate) : null;
    }
    assertValidPeriod(medication);
    const { endDate: newEndDate } = medication;
    return MedicationResponseDto.fromEntity(
      await this.dataSource.transaction(async (manager) => {
        // An end date brought forward drops the doses after it.
        if (endDate && newEndDate) {
          await cancelDosesAfter(
            manager,
            id,
            latest(newEndDate, new Date()),
            staffIdOf(currentUser),
          );
        }
        return manager.save(medication);
      }),
    );
  }

  // Ending a treatment keeps the prescription as history instead of deleting
  // it; an end date already in the past is kept, any other becomes now. Its
  // doses still ahead are cancelled.
  async deactivate(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<MedicationResponseDto> {
    const medication = await this.findEditableOrThrow(id, currentUser);
    const now = new Date();
    medication.active = false;
    if (!medication.endDate || medication.endDate > now) {
      medication.endDate = now;
    }
    return MedicationResponseDto.fromEntity(
      await this.dataSource.transaction(async (manager) => {
        await cancelDosesAfter(manager, id, now, staffIdOf(currentUser));
        return manager.save(medication);
      }),
    );
  }

  private async findEditableOrThrow(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<Medication> {
    const medication = await this.findOrThrow(id);
    await this.residentAccess.assertCanEditProfile(
      medication.resident,
      currentUser,
    );
    if (!medication.active) {
      throw new ConflictException(`Medication ${id} was already deactivated`);
    }
    return medication;
  }

  private async findOrThrow(id: string): Promise<Medication> {
    const medication = await this.medicationRepository.findOne({
      where: { id },
      relations: { resident: true },
    });
    if (!medication) {
      throw new NotFoundException(`Medication ${id} not found`);
    }
    return medication;
  }

  private async findResidentOrThrow(id: string): Promise<Resident> {
    const resident = await this.residentRepository.findOneBy({ id });
    if (!resident) {
      throw new NotFoundException(`Resident ${id} not found`);
    }
    return resident;
  }

  private ownClinicId(currentUser: AuthenticatedUser): string {
    if (currentUser.role !== UserRole.STAFF || !currentUser.clinicId) {
      throw new ForbiddenException('Only staff members can do this');
    }
    return currentUser.clinicId;
  }
}

// Who registered the cancelled doses; null when a guardian ends the treatment
// of a resident without clinic.
function staffIdOf(currentUser: AuthenticatedUser): string | null {
  return currentUser.role === UserRole.STAFF ? currentUser.id : null;
}

function latest(first: Date, second: Date): Date {
  return first > second ? first : second;
}

function assertValidPeriod({ startDate, endDate }: Medication) {
  if (endDate && endDate < startDate) {
    throw new BadRequestException('endDate must not be before startDate');
  }
}
