import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { StaffMember } from './entities/staff-member.entity.js';
import { StaffController } from './controllers/staff.controller.js';
import { StaffService } from './services/staff.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([StaffMember]), AuthModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
