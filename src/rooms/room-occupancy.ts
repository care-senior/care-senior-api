import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Resident } from '../residents/entities/resident.entity.js';
import { Room } from './entities/room.entity.js';

// The room row stays locked until the transaction ends, so two concurrent
// placements can't both take the last free bed.
export async function lockRoomWithFreeBed(
  manager: EntityManager,
  roomId: string,
  clinicId: string,
): Promise<Room> {
  const room = await manager
    .getRepository(Room)
    .createQueryBuilder('room')
    .setLock('pessimistic_write')
    .where('room.id = :roomId', { roomId })
    .getOne();
  if (!room) {
    throw new NotFoundException(`Room ${roomId} not found`);
  }
  if (room.clinicId !== clinicId) {
    throw new ForbiddenException('Room belongs to another clinic');
  }
  const occupants = await manager.count(Resident, { where: { roomId } });
  if (occupants >= room.capacity) {
    throw new ConflictException(`Room ${room.number} is full`);
  }
  return room;
}
