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
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { CreateRoutineDto } from '../dto/create-routine.dto.js';
import { QueryRoutinesDto } from '../dto/query-routines.dto.js';
import {
  RoutinePageDto,
  RoutineResponseDto,
} from '../dto/routine-response.dto.js';
import { UpdateRoutineDto } from '../dto/update-routine.dto.js';
import { RoutinesService } from '../services/routines.service.js';

@ApiTags('Routines')
@ApiBearerAuth()
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  /** Routines of your clinic, by time of day. */
  @Get()
  findAll(
    @Query() query: QueryRoutinesDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoutinePageDto> {
    return this.routinesService.findAll(query, currentUser);
  }

  /** Also generates its activities for the next 7 days. */
  @Post()
  create(
    @Body() dto: CreateRoutineDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoutineResponseDto> {
    return this.routinesService.create(dto, currentUser);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoutineResponseDto> {
    return this.routinesService.findOne(id, currentUser);
  }

  /** Upcoming activities nobody started or edited are generated again. */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoutineDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoutineResponseDto> {
    return this.routinesService.update(id, dto, currentUser);
  }

  /** Pauses or resumes; pausing removes the upcoming activities nobody started or edited. */
  @Patch(':id/toggle')
  toggle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoutineResponseDto> {
    return this.routinesService.toggle(id, currentUser);
  }

  /** Removes the upcoming activities nobody started or edited; the rest stays as history. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.routinesService.remove(id, currentUser);
  }
}
