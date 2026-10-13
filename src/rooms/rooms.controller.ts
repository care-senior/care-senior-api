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
import { CreateRoomDto } from './dto/create-room.dto.js';
import { QueryRoomsDto } from './dto/query-rooms.dto.js';
import { RoomPageDto, RoomResponseDto } from './dto/room-response.dto.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';
import { RoomsService } from './rooms.service.js';

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll(
    @Query() query: QueryRoomsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoomPageDto> {
    return this.roomsService.findAll(query, currentUser);
  }

  @Post()
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  create(
    @Body() dto: CreateRoomDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoomResponseDto> {
    return this.roomsService.create(dto, currentUser);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoomResponseDto> {
    return this.roomsService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoomResponseDto> {
    return this.roomsService.update(id, dto, currentUser);
  }

  /** Only an empty room can be deleted. */
  @Delete(':id')
  @Roles(...ROLES_THAT_MANAGE_REQUESTS)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.roomsService.remove(id, currentUser);
  }
}
