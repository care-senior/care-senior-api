import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { CreateMedicationDto } from '../dto/create-medication.dto.js';
import {
  MedicationPageDto,
  MedicationResponseDto,
} from '../dto/medication-response.dto.js';
import { QueryMedicationsDto } from '../dto/query-medications.dto.js';
import { UpdateMedicationDto } from '../dto/update-medication.dto.js';
import { MedicationsService } from '../services/medications.service.js';

@ApiTags('Medications')
@ApiBearerAuth()
@Controller('medications')
export class MedicationsController {
  constructor(private readonly medicationsService: MedicationsService) {}

  @Get()
  findAll(
    @Query() query: QueryMedicationsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MedicationPageDto> {
    return this.medicationsService.findAll(query, currentUser);
  }

  @Post()
  create(
    @Body() dto: CreateMedicationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MedicationResponseDto> {
    return this.medicationsService.create(dto, currentUser);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MedicationResponseDto> {
    return this.medicationsService.findOne(id, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MedicationResponseDto> {
    return this.medicationsService.update(id, dto, currentUser);
  }

  /** Ends the treatment and keeps it as history. */
  @Patch(':id/deactivate')
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MedicationResponseDto> {
    return this.medicationsService.deactivate(id, currentUser);
  }
}
