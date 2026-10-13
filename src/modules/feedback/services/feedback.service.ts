import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import { paginate } from '../../../common/dto/paginated-response.dto.js';
import { UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { StaffMember } from '../../staff/entities/staff-member.entity.js';
import type { CreateFeedbackDto } from '../dto/create-feedback.dto.js';
import {
  FeedbackPageDto,
  FeedbackResponseDto,
} from '../dto/feedback-response.dto.js';
import type { QueryFeedbackDto } from '../dto/query-feedback.dto.js';
import { UserFeedback } from '../entities/user-feedback.entity.js';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(UserFeedback)
    private readonly feedbackRepository: Repository<UserFeedback>,
    @InjectRepository(StaffMember)
    private readonly staffRepository: Repository<StaffMember>,
    @InjectRepository(Guardian)
    private readonly guardianRepository: Repository<Guardian>,
    @InjectRepository(Resident)
    private readonly residentRepository: Repository<Resident>,
  ) {}

  async findAll(
    query: QueryFeedbackDto,
    currentUser: AuthenticatedUser,
  ): Promise<FeedbackPageDto> {
    const clinicId = this.ownClinicId(currentUser);
    if (query.clinicId && query.clinicId !== clinicId) {
      throw new ForbiddenException(
        'Staff can only list the feedback of their own clinic',
      );
    }
    const queryBuilder = this.feedbackRepository
      .createQueryBuilder('feedback')
      .where(':clinicId = ANY(feedback.clinic_ids)', { clinicId })
      .orderBy('feedback.sentAt', 'DESC')
      .addOrderBy('feedback.id', 'DESC');
    if (query.authorRole) {
      queryBuilder.andWhere('feedback.authorRole = :authorRole', {
        authorRole: query.authorRole,
      });
    }

    const result = await paginate(queryBuilder, query);
    return {
      ...result,
      data: result.data.map((feedback) => toResponse(feedback)),
    };
  }

  async create(
    { rating, message }: CreateFeedbackDto,
    currentUser: AuthenticatedUser,
  ): Promise<FeedbackResponseDto> {
    const saved = await this.feedbackRepository.save(
      this.feedbackRepository.create({
        authorId: currentUser.id,
        authorRole: currentUser.role,
        authorName: await this.authorName(currentUser),
        clinicIds: await this.clinicIdsOf(currentUser),
        rating,
        message,
      }),
    );
    return toResponse(saved);
  }

  // A guardian's feedback goes to the clinics of their residents at the time;
  // one whose residents have no clinic yet reaches no clinic.
  private async clinicIdsOf(currentUser: AuthenticatedUser): Promise<string[]> {
    if (currentUser.role === UserRole.STAFF) {
      return [this.ownClinicId(currentUser)];
    }
    const rows = await this.residentRepository
      .createQueryBuilder('resident')
      .select('DISTINCT resident.clinicId', 'clinicId')
      .innerJoin('resident.guardians', 'guardian', 'guardian.id = :id', {
        id: currentUser.id,
      })
      .where('resident.clinicId IS NOT NULL')
      .getRawMany<{ clinicId: string }>();
    return rows.map(({ clinicId }) => clinicId);
  }

  private async authorName(currentUser: AuthenticatedUser): Promise<string> {
    const repository: Repository<StaffMember | Guardian> =
      currentUser.role === UserRole.STAFF
        ? this.staffRepository
        : this.guardianRepository;
    const author = await repository.findOne({
      where: { id: currentUser.id },
      select: { id: true, name: true },
    });
    if (!author) {
      throw new ForbiddenException('Account not found');
    }
    return author.name;
  }

  private ownClinicId(currentUser: AuthenticatedUser): string {
    if (currentUser.role !== UserRole.STAFF || !currentUser.clinicId) {
      throw new ForbiddenException('Only staff members can do this');
    }
    return currentUser.clinicId;
  }
}

function toResponse(feedback: UserFeedback): FeedbackResponseDto {
  return plainToInstance(FeedbackResponseDto, feedback, {
    excludeExtraneousValues: true,
  });
}
