import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { CreateMessageDto } from '../dto/create-message.dto.js';
import {
  MessagePageDto,
  MessageResponseDto,
} from '../dto/message-response.dto.js';
import { QueryMessagesDto } from '../dto/query-messages.dto.js';
import { MessagesService } from '../services/messages.service.js';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /** Newest first. */
  @Get()
  findAll(
    @Query() query: QueryMessagesDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MessagePageDto> {
    return this.messagesService.findAll(query, currentUser);
  }

  @Post()
  create(
    @Body() dto: CreateMessageDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    return this.messagesService.create(dto, currentUser);
  }
}
