import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import { paginate } from '../../../common/dto/paginated-response.dto.js';
import { UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { ResidentAccessService } from '../../residents/services/resident-access.service.js';
import { StaffMember } from '../../staff/entities/staff-member.entity.js';
import type { CreateMessageDto } from '../dto/create-message.dto.js';
import {
  MessagePageDto,
  MessageResponseDto,
} from '../dto/message-response.dto.js';
import type { QueryMessagesDto } from '../dto/query-messages.dto.js';
import { Message } from '../entities/message.entity.js';

// Messages are between a resident's family and the clinic the resident lives
// in, so the staff side is always the resident's current clinic.
@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Resident)
    private readonly residentRepository: Repository<Resident>,
    @InjectRepository(StaffMember)
    private readonly staffRepository: Repository<StaffMember>,
    @InjectRepository(Guardian)
    private readonly guardianRepository: Repository<Guardian>,
    private readonly residentAccess: ResidentAccessService,
  ) {}

  async findAll(
    query: QueryMessagesDto,
    currentUser: AuthenticatedUser,
  ): Promise<MessagePageDto> {
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .innerJoin('message.resident', 'resident')
      .orderBy('message.sentAt', 'DESC')
      .addOrderBy('message.id', 'DESC');

    if (query.residentId) {
      await this.assertCanTalkAbout(
        await this.findResidentOrThrow(query.residentId),
        currentUser,
      );
      queryBuilder.andWhere('message.residentId = :residentId', {
        residentId: query.residentId,
      });
    } else if (currentUser.role === UserRole.GUARDIAN) {
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1 FROM guardian_resident link
          WHERE link.resident_id = message.resident_id
            AND link.guardian_id = :guardianId
        )`,
        { guardianId: currentUser.id },
      );
    } else {
      queryBuilder.andWhere('resident.clinicId = :clinicId', {
        clinicId: this.ownClinicId(currentUser),
      });
    }

    const result = await paginate(queryBuilder, query);
    return {
      ...result,
      data: result.data.map((message) => toResponse(message)),
    };
  }

  async create(
    { residentId, text }: CreateMessageDto,
    currentUser: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    const resident = await this.findResidentOrThrow(residentId);
    await this.assertCanTalkAbout(resident, currentUser);
    if (!resident.clinicId) {
      throw new ConflictException(
        'Messages need a resident linked to a clinic',
      );
    }

    const saved = await this.messageRepository.save(
      this.messageRepository.create({
        residentId,
        senderId: currentUser.id,
        senderRole: currentUser.role,
        senderName: await this.senderName(currentUser),
        text,
      }),
    );
    return toResponse(saved);
  }

  private async assertCanTalkAbout(
    resident: Resident,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.role === UserRole.GUARDIAN) {
      await this.residentAccess.assertIsGuardianOf(resident.id, currentUser.id);
      return;
    }
    this.residentAccess.assertLinkedTo(resident, this.ownClinicId(currentUser));
  }

  private async senderName(currentUser: AuthenticatedUser): Promise<string> {
    const repository: Repository<StaffMember | Guardian> =
      currentUser.role === UserRole.STAFF
        ? this.staffRepository
        : this.guardianRepository;
    const sender = await repository.findOne({
      where: { id: currentUser.id },
      select: { id: true, name: true },
    });
    if (!sender) {
      throw new ForbiddenException('Account not found');
    }
    return sender.name;
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

function toResponse(message: Message): MessageResponseDto {
  return plainToInstance(MessageResponseDto, message, {
    excludeExtraneousValues: true,
  });
}
