import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { StaffMember } from './entities/staff-member.entity.js';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([StaffMember]), AuthModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
