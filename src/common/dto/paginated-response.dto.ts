import { type Type as ClassType } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import type { SelectQueryBuilder } from 'typeorm';
import type { PaginationQueryDto } from './pagination-query.dto.js';

export class PaginationMetaDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMetaDto;
}

export async function paginate<T extends object>(
  queryBuilder: SelectQueryBuilder<T>,
  { page, limit }: PaginationQueryDto,
): Promise<PaginatedResult<T>> {
  const [data, total] = await queryBuilder
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Generic interfaces vanish at runtime, so Swagger can't describe
 * `PaginatedResult<T>`. Each resource declares a concrete page class with
 * `class XPageDto extends PaginatedResponseDto(XResponseDto) {}`.
 */
export function PaginatedResponseDto<T>(itemType: ClassType<T>) {
  class PaginatedResponse implements PaginatedResult<T> {
    @ApiProperty({ type: [itemType] })
    data!: T[];

    meta!: PaginationMetaDto;
  }
  return PaginatedResponse;
}
