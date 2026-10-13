import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../../../common/dto/paginated-response.dto.js';
import {
  NotificationType,
  OutingRequestStatus,
  ROLES_THAT_MANAGE_REQUESTS,
  UserRole,
} from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { containsPattern } from '../../../common/utils/like-pattern.js';
import { NotifierService } from '../../notifications/services/notifier.service.js';
import { formatDateTime } from '../../notifications/utils/notification-text.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { ResidentAccessService } from '../../residents/services/resident-access.service.js';
import type { CreateOutingRequestDto } from '../dto/create-outing-request.dto.js';
import {
  OutingRequestPageDto,
  OutingRequestResponseDto,
} from '../dto/outing-request-response.dto.js';
import type { QueryOutingRequestsDto } from '../dto/query-outing-requests.dto.js';
import type { RejectOutingRequestDto } from '../dto/reject-outing-request.dto.js';
import { OutingRequest } from '../entities/outing-request.entity.js';

@Injectable()
export class OutingRequestsService {
  constructor(
    @InjectRepository(OutingRequest)
    private readonly outingRequestRepository: Repository<OutingRequest>,
    @InjectRepository(Resident)
    private readonly residentRepository: Repository<Resident>,
    private readonly residentAccess: ResidentAccessService,
    private readonly notifier: NotifierService,
  ) {}

  async create(
    dto: CreateOutingRequestDto,
    currentUser: AuthenticatedUser,
  ): Promise<OutingRequestResponseDto> {
    if (currentUser.role !== UserRole.GUARDIAN) {
      throw new ForbiddenException(
        "Only the resident's guardian can request an outing",
      );
    }
    const departureAt = new Date(dto.departureAt);
    const returnAt = new Date(dto.returnAt);
    if (departureAt <= new Date()) {
      throw new BadRequestException('departureAt must be in the future');
    }
    if (returnAt <= departureAt) {
      throw new BadRequestException('returnAt must be after departureAt');
    }

    const resident = await this.residentRepository.findOneBy({
      id: dto.residentId,
    });
    if (!resident) {
      throw new NotFoundException(`Resident ${dto.residentId} not found`);
    }
    await this.residentAccess.assertIsGuardianOf(resident.id, currentUser.id);
    if (!resident.clinicId) {
      throw new ConflictException(
        'Only a resident linked to a clinic can have outings approved',
      );
    }

    const saved = await this.outingRequestRepository.save(
      this.outingRequestRepository.create({
        residentId: resident.id,
        guardianId: currentUser.id,
        departureAt,
        returnAt,
        notes: dto.notes,
        status: OutingRequestStatus.PENDING,
      }),
    );
    const created = await this.findOrThrow(saved.id);
    await this.notifier.notify(
      {
        type: NotificationType.GENERAL,
        title: 'Nova solicitação de saída',
        message: `${created.guardian.name} pediu a saída de ${resident.name} de ${formatDateTime(departureAt)} a ${formatDateTime(returnAt)}.`,
      },
      {
        staffOf: {
          clinicId: resident.clinicId,
          staffRoles: ROLES_THAT_MANAGE_REQUESTS,
        },
      },
    );
    return OutingRequestResponseDto.fromEntity(created);
  }

  async findAll(
    query: QueryOutingRequestsDto,
    currentUser: AuthenticatedUser,
  ): Promise<OutingRequestPageDto> {
    const queryBuilder = this.outingRequestRepository
      .createQueryBuilder('outingRequest')
      .innerJoin('outingRequest.resident', 'resident')
      .addSelect(['resident.id', 'resident.name', 'resident.clinicId'])
      .innerJoin('outingRequest.guardian', 'guardian')
      .addSelect(['guardian.id', 'guardian.name'])
      .orderBy('outingRequest.createdAt', 'DESC')
      .addOrderBy('outingRequest.id', 'DESC');

    if (currentUser.role === UserRole.GUARDIAN) {
      if (query.residentId) {
        await this.residentAccess.assertIsGuardianOf(
          query.residentId,
          currentUser.id,
        );
      }
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1 FROM guardian_resident link
          WHERE link.resident_id = "outingRequest".resident_id
            AND link.guardian_id = :guardianId
        )`,
        { guardianId: currentUser.id },
      );
      if (query.clinicId) {
        queryBuilder.andWhere('resident.clinicId = :clinicId', {
          clinicId: query.clinicId,
        });
      }
    } else {
      const clinicId = this.ownClinicId(currentUser);
      if (query.clinicId && query.clinicId !== clinicId) {
        throw new ForbiddenException(
          'Staff can only list outing requests of their own clinic',
        );
      }
      queryBuilder.andWhere('resident.clinicId = :clinicId', { clinicId });
    }

    if (query.residentId) {
      queryBuilder.andWhere('outingRequest.residentId = :residentId', {
        residentId: query.residentId,
      });
    }
    if (query.status) {
      queryBuilder.andWhere('outingRequest.status = :status', {
        status: query.status,
      });
    }
    if (query.search) {
      queryBuilder.andWhere(
        '(resident.name ILIKE :search OR guardian.name ILIKE :search)',
        { search: containsPattern(query.search) },
      );
    }

    const result = await paginate(queryBuilder, query);
    return {
      ...result,
      data: result.data.map((outingRequest) =>
        OutingRequestResponseDto.fromEntity(outingRequest),
      ),
    };
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<OutingRequestResponseDto> {
    const outingRequest = await this.findOrThrow(id);
    if (currentUser.role === UserRole.GUARDIAN) {
      await this.residentAccess.assertIsGuardianOf(
        outingRequest.residentId,
        currentUser.id,
      );
    } else {
      this.residentAccess.assertLinkedTo(
        outingRequest.resident,
        this.ownClinicId(currentUser),
      );
    }
    return OutingRequestResponseDto.fromEntity(outingRequest);
  }

  approve(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<OutingRequestResponseDto> {
    return this.answer(
      id,
      { status: OutingRequestStatus.APPROVED },
      currentUser,
    );
  }

  reject(
    id: string,
    { reason }: RejectOutingRequestDto,
    currentUser: AuthenticatedUser,
  ): Promise<OutingRequestResponseDto> {
    return this.answer(
      id,
      { status: OutingRequestStatus.REJECTED, rejectionReason: reason },
      currentUser,
    );
  }

  async cancel(id: string, currentUser: AuthenticatedUser): Promise<void> {
    const outingRequest = await this.findOrThrow(id);
    if (
      currentUser.role !== UserRole.GUARDIAN ||
      outingRequest.guardianId !== currentUser.id
    ) {
      throw new ForbiddenException(
        'Only the guardian who made the request can cancel it',
      );
    }
    const { affected } = await this.outingRequestRepository.delete({
      id,
      status: OutingRequestStatus.PENDING,
    });
    if (!affected) {
      throw new ConflictException(
        'Only pending outing requests can be cancelled',
      );
    }
  }

  // The status condition in the UPDATE makes the answer atomic: if two
  // coordinators answer at the same time, only the first one wins.
  private async answer(
    id: string,
    answer: Pick<OutingRequest, 'status' | 'rejectionReason'>,
    currentUser: AuthenticatedUser,
  ): Promise<OutingRequestResponseDto> {
    const outingRequest = await this.findOrThrow(id);
    this.residentAccess.assertLinkedTo(
      outingRequest.resident,
      this.ownClinicId(currentUser),
    );
    const { affected } = await this.outingRequestRepository.update(
      { id, status: OutingRequestStatus.PENDING },
      { ...answer, respondedAt: new Date() },
    );
    if (!affected) {
      throw new ConflictException(`Outing request ${id} was already answered`);
    }
    const answered = await this.findOrThrow(id);
    const when = formatDateTime(answered.departureAt);
    await this.notifier.notify(
      answer.status === OutingRequestStatus.APPROVED
        ? {
            type: NotificationType.GENERAL,
            title: 'Saída aprovada',
            message: `A saída de ${answered.resident.name} em ${when} foi aprovada.`,
          }
        : {
            type: NotificationType.GENERAL,
            title: 'Saída recusada',
            message: `A saída de ${answered.resident.name} em ${when} foi recusada: ${answer.rejectionReason}`,
          },
      { guardiansOf: answered.residentId },
    );
    return OutingRequestResponseDto.fromEntity(answered);
  }

  private async findOrThrow(id: string): Promise<OutingRequest> {
    const outingRequest = await this.outingRequestRepository.findOne({
      where: { id },
      relations: { resident: true, guardian: true },
    });
    if (!outingRequest) {
      throw new NotFoundException(`Outing request ${id} not found`);
    }
    return outingRequest;
  }

  private ownClinicId(currentUser: AuthenticatedUser): string {
    if (currentUser.role !== UserRole.STAFF || !currentUser.clinicId) {
      throw new ForbiddenException('Only staff members can do this');
    }
    return currentUser.clinicId;
  }
}
