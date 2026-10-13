import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import { paginate } from '../common/dto/paginated-response.dto.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import { containsPattern } from '../common/utils/like-pattern.js';
import { ClinicPageDto, ClinicResponseDto } from './dto/clinic-response.dto.js';
import type { QueryClinicsDto } from './dto/query-clinics.dto.js';
import type { UpdateClinicDto } from './dto/update-clinic.dto.js';
import { Clinic } from './entities/clinic.entity.js';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async findAll(query: QueryClinicsDto): Promise<ClinicPageDto> {
    const queryBuilder = this.clinicRepository
      .createQueryBuilder('clinic')
      .orderBy('clinic.name', 'ASC')
      .addOrderBy('clinic.id', 'ASC');

    if (query.search) {
      queryBuilder.andWhere(
        '(clinic.name ILIKE :search OR clinic.address ILIKE :search)',
        { search: containsPattern(query.search) },
      );
    }

    const result = await paginate(queryBuilder, query);
    return {
      ...result,
      data: result.data.map((clinic) => this.toResponse(clinic)),
    };
  }

  async findOne(id: string): Promise<ClinicResponseDto> {
    return this.toResponse(await this.findEntityOrThrow(id));
  }

  async update(
    id: string,
    dto: UpdateClinicDto,
    currentUser: AuthenticatedUser,
  ): Promise<ClinicResponseDto> {
    if (currentUser.clinicId !== id) {
      throw new ForbiddenException('Staff can only edit their own clinic');
    }
    const clinic = await this.findEntityOrThrow(id);
    const saved = await this.clinicRepository.save(
      this.clinicRepository.merge(clinic, dto),
    );
    return this.toResponse(saved);
  }

  private async findEntityOrThrow(id: string): Promise<Clinic> {
    const clinic = await this.clinicRepository.findOne({ where: { id } });
    if (!clinic) {
      throw new NotFoundException(`Clinic ${id} not found`);
    }
    return clinic;
  }

  private toResponse(clinic: Clinic): ClinicResponseDto {
    return plainToInstance(ClinicResponseDto, clinic, {
      excludeExtraneousValues: true,
    });
  }
}
