import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { ROLES_THAT_MANAGE_REQUESTS } from '../common/enums/index.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import {
  GuardianPageDto,
  GuardianResponseDto,
} from '../guardians/dto/guardian-response.dto.js';
import { AddGuardianDto } from './dto/add-guardian.dto.js';
import { AssignRoomDto } from './dto/assign-room.dto.js';
import { QueryResidentsDto } from './dto/query-residents.dto.js';
import {
  ResidentPageDto,
  ResidentResponseDto,
} from './dto/resident-response.dto.js';
import { UpdateResidentDto } from './dto/update-resident.dto.js';
import { ResidentsService } from './residents.service.js';

@ApiTags('Residents')
@ApiBearerAuth()
@Controller('residents')
export class ResidentsController {
  constructor(private readonly residentsService: ResidentsService) {}

  @Get()
  findAll(
    @Query() query: QueryResidentsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResidentPageDto> {
    return this.residentsService.findAll(query, currentUser);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResidentResponseDto> {
    return this.residentsService.findOne(id, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResidentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResidentResponseDto> {
    return this.residentsService.update(id, dto, currentUser);
  }

  /** Accepts a pending link request, placing the resident in a room of the caller clinic. */
  @Post(':id/link')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  @HttpCode(HttpStatus.OK)
  link(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoomDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResidentResponseDto> {
    return this.residentsService.link(id, dto, currentUser);
  }

  @Post(':id/discharge')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  @HttpCode(HttpStatus.OK)
  discharge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResidentResponseDto> {
    return this.residentsService.discharge(id, currentUser);
  }

  @Post(':id/change-room')
  @HttpCode(HttpStatus.OK)
  changeRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoomDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResidentResponseDto> {
    return this.residentsService.changeRoom(id, dto, currentUser);
  }

  @Get(':id/guardians')
  findGuardians(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GuardianPageDto> {
    return this.residentsService.findGuardians(id, query, currentUser);
  }

  /** Registers one more guardian for the resident and sends the invite. */
  @Post(':id/guardians')
  addGuardian(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddGuardianDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GuardianResponseDto> {
    return this.residentsService.addGuardian(id, dto, currentUser);
  }

  /** Unlinks the guardian from the resident; the guardian account stays. */
  @Delete(':id/guardians/:guardianId')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGuardian(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.residentsService.removeGuardian(id, guardianId, currentUser);
  }
}
