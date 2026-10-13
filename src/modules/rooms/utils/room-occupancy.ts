import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Resident } from '../../residents/entities/resident.entity.js';
import { Room } from '../entities/room.entity.js';

// The room row stays locked until the transaction ends, so placing a
// resident, changing the capacity and deleting the room never interleave.
export async function lockRoom(
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
  return room;
}

export async function lockRoomWithFreeBed(
  manager: EntityManager,
  roomId: string,
  clinicId: string,
): Promise<Room> {
  const room = await lockRoom(manager, roomId, clinicId);
  const occupants = await countOccupants(manager, roomId);
  if (occupants >= room.capacity) {
    throw new ConflictException(`Room ${room.number} is full`);
  }
  return room;
}

export function countOccupants(
  manager: EntityManager,
  roomId: string,
): Promise<number> {
  return manager.count(Resident, { where: { roomId } });
}
