import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES_THAT_MANAGE_REQUESTS } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { CreateOutingRequestDto } from '../dto/create-outing-request.dto.js';
import {
  OutingRequestPageDto,
  OutingRequestResponseDto,
} from '../dto/outing-request-response.dto.js';
import { QueryOutingRequestsDto } from '../dto/query-outing-requests.dto.js';
import { RejectOutingRequestDto } from '../dto/reject-outing-request.dto.js';
import { OutingRequestsService } from '../services/outing-requests.service.js';

@ApiTags('OutingRequests')
@ApiBearerAuth()
@Controller('outing-requests')
export class OutingRequestsController {
  constructor(private readonly outingRequestsService: OutingRequestsService) {}

  @Get()
  findAll(
    @Query() query: QueryOutingRequestsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OutingRequestPageDto> {
    return this.outingRequestsService.findAll(query, currentUser);
  }

  @Post()
  create(
    @Body() dto: CreateOutingRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OutingRequestResponseDto> {
    return this.outingRequestsService.create(dto, currentUser);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OutingRequestResponseDto> {
    return this.outingRequestsService.findOne(id, currentUser);
  }

  @Post(':id/approve')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OutingRequestResponseDto> {
    return this.outingRequestsService.approve(id, currentUser);
  }

  @Post(':id/reject')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOutingRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OutingRequestResponseDto> {
    return this.outingRequestsService.reject(id, dto, currentUser);
  }

  /** Only the guardian who asked, and only while pending. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.outingRequestsService.cancel(id, currentUser);
  }
}
