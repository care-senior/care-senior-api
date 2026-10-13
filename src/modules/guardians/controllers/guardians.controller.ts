import {
  Body,
  Controller,
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
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES_THAT_MANAGE_REQUESTS } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { ContactClinicQueryDto } from '../dto/contact-clinic-query.dto.js';
import { CreateGuardianDto } from '../dto/create-guardian.dto.js';
import { GuardianResponseDto } from '../dto/guardian-response.dto.js';
import { PendingLinkRequestPageDto } from '../dto/pending-link-request.dto.js';
import { QueryPendingLinkRequestsDto } from '../dto/query-pending-link-requests.dto.js';
import { UpdateGuardianDto } from '../dto/update-guardian.dto.js';
import { UpdateOwnGuardianProfileDto } from '../dto/update-own-guardian-profile.dto.js';
import { WalkInResponseDto } from '../dto/walk-in-response.dto.js';
import { GuardiansService } from '../services/guardians.service.js';

@ApiTags('Guardians')
@ApiBearerAuth()
@Controller('guardians')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  /** Walk-in signup by the clinic staff: guardian + resident in a room. */
  @Post()
  create(
    @Body() dto: CreateGuardianDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WalkInResponseDto> {
    return this.guardiansService.create(dto, currentUser);
  }

  @Get('pending-link-requests')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  findPendingLinkRequests(
    @Query() query: QueryPendingLinkRequestsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PendingLinkRequestPageDto> {
    return this.guardiansService.findPendingLinkRequests(query, currentUser);
  }

  @Patch('me')
  updateMe(
    @Body() dto: UpdateOwnGuardianProfileDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GuardianResponseDto> {
    return this.guardiansService.updateMe(dto, currentUser);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GuardianResponseDto> {
    return this.guardiansService.findOne(id, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuardianDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GuardianResponseDto> {
    return this.guardiansService.update(id, dto, currentUser);
  }

  @Post(':id/contact-clinic')
  @HttpCode(HttpStatus.OK)
  contactClinic(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ContactClinicQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GuardianResponseDto> {
    return this.guardiansService.contactClinic(id, query, currentUser);
  }
}
