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
import { ROLES_THAT_MANAGE_REQUESTS } from '../common/enums/index.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { QueryStaffDto } from './dto/query-staff.dto.js';
import { StaffPageDto, StaffResponseDto } from './dto/staff-response.dto.js';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { StaffService } from './staff.service.js';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  findAll(
    @Query() query: QueryStaffDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<StaffPageDto> {
    return this.staffService.findAll(query, currentUser);
  }

  @Post()
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  create(
    @Body() dto: CreateStaffDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<StaffResponseDto> {
    return this.staffService.create(dto, currentUser);
  }

  @Get('me')
  findMe(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<StaffResponseDto> {
    return this.staffService.findMe(currentUser);
  }

  @Patch('me')
  updateMe(
    @Body() dto: UpdateOwnProfileDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<StaffResponseDto> {
    return this.staffService.updateMe(dto, currentUser);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<StaffResponseDto> {
    return this.staffService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<StaffResponseDto> {
    return this.staffService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.staffService.deactivate(id, currentUser);
  }
}
