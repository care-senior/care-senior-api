import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { CreateHealthRecordDto } from '../dto/create-health-record.dto.js';
import {
  HealthRecordPageDto,
  HealthRecordResponseDto,
} from '../dto/health-record-response.dto.js';
import { QueryHealthRecordsDto } from '../dto/query-health-records.dto.js';
import { HealthRecordsService } from '../services/health-records.service.js';

@ApiTags('HealthRecords')
@ApiBearerAuth()
@Controller('health-records')
export class HealthRecordsController {
  constructor(private readonly healthRecordsService: HealthRecordsService) {}

  @Get()
  findAll(
    @Query() query: QueryHealthRecordsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<HealthRecordPageDto> {
    return this.healthRecordsService.findAll(query, currentUser);
  }

  @Post()
  create(
    @Body() dto: CreateHealthRecordDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<HealthRecordResponseDto> {
    return this.healthRecordsService.create(dto, currentUser);
  }
}
