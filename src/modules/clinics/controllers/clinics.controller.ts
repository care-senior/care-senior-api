import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES_THAT_MANAGE_REQUESTS } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { ClinicsService } from '../services/clinics.service.js';
import {
  ClinicPageDto,
  ClinicResponseDto,
} from '../dto/clinic-response.dto.js';
import { QueryClinicsDto } from '../dto/query-clinics.dto.js';
import { UpdateClinicDto } from '../dto/update-clinic.dto.js';

@ApiTags('Clinics')
@ApiBearerAuth()
@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  findAll(@Query() query: QueryClinicsDto): Promise<ClinicPageDto> {
    return this.clinicsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ClinicResponseDto> {
    return this.clinicsService.findOne(id);
  }

  @Patch(':id')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClinicDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ClinicResponseDto> {
    return this.clinicsService.update(id, dto, currentUser);
  }
}
