import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../../../common/dto/paginated-response.dto.js';
import { UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { ResidentAccessService } from '../../residents/services/resident-access.service.js';
import type { CreateHealthRecordDto } from '../dto/create-health-record.dto.js';
import {
  HealthRecordPageDto,
  HealthRecordResponseDto,
} from '../dto/health-record-response.dto.js';
import type { QueryHealthRecordsDto } from '../dto/query-health-records.dto.js';
import { HealthRecord } from '../entities/health-record.entity.js';

@Injectable()
export class HealthRecordsService {
  constructor(
    @InjectRepository(HealthRecord)
    private readonly healthRecordRepository: Repository<HealthRecord>,
    @InjectRepository(Resident)
    private readonly residentRepository: Repository<Resident>,
    private readonly residentAccess: ResidentAccessService,
  ) {}

  async findAll(
    query: QueryHealthRecordsDto,
    currentUser: AuthenticatedUser,
  ): Promise<HealthRecordPageDto> {
    if (query.from && query.to && new Date(query.to) <= new Date(query.from)) {
      throw new BadRequestException('to must be after from');
    }

    const queryBuilder = this.healthRecordRepository
      .createQueryBuilder('healthRecord')
      .innerJoin('healthRecord.resident', 'resident')
      .addSelect(['resident.id', 'resident.name'])
      .innerJoin('healthRecord.recordedBy', 'recordedBy')
      .addSelect(['recordedBy.id', 'recordedBy.name'])
      .orderBy('healthRecord.recordedAt', 'DESC')
      .addOrderBy('healthRecord.id', 'DESC');

    if (query.residentId) {
      await this.residentAccess.assertCanView(
        await this.findResidentOrThrow(query.residentId),
        currentUser,
      );
      queryBuilder.andWhere('healthRecord.residentId = :residentId', {
        residentId: query.residentId,
      });
    } else if (currentUser.role === UserRole.GUARDIAN) {
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1 FROM guardian_resident link
          WHERE link.resident_id = "healthRecord".resident_id
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
          'Staff can only list health records of their own clinic',
        );
      }
      queryBuilder.andWhere('resident.clinicId = :clinicId', {
        clinicId: query.clinicId,
      });
    }
    if (query.type) {
      queryBuilder.andWhere('healthRecord.type = :type', { type: query.type });
    }
    if (query.from) {
      queryBuilder.andWhere('healthRecord.recordedAt >= :from', {
        from: new Date(query.from),
      });
    }
    if (query.to) {
      queryBuilder.andWhere('healthRecord.recordedAt < :to', {
        to: new Date(query.to),
      });
    }

    const result = await paginate(queryBuilder, query);
    return {
      ...result,
      data: result.data.map((healthRecord) =>
        HealthRecordResponseDto.fromEntity(healthRecord, currentUser),
      ),
    };
  }

  // Readings are taken by the clinic, so only its staff records them, for
  // residents linked to it.
  async create(
    { residentId, type, value, recordedAt }: CreateHealthRecordDto,
    currentUser: AuthenticatedUser,
  ): Promise<HealthRecordResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    const recordedAtDate = recordedAt ? new Date(recordedAt) : new Date();
    if (recordedAtDate > new Date()) {
      throw new BadRequestException('recordedAt can not be in the future');
    }
    const resident = await this.findResidentOrThrow(residentId);
    this.residentAccess.assertLinkedTo(resident, clinicId);

    const saved = await this.healthRecordRepository.save(
      this.healthRecordRepository.create({
        residentId,
        type,
        value,
        recordedAt: recordedAtDate,
        recordedByStaffId: currentUser.id,
      }),
    );
    const healthRecord = await this.healthRecordRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { resident: true, recordedBy: true },
    });
    return HealthRecordResponseDto.fromEntity(healthRecord, currentUser);
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
