import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guardian } from '../guardians/entities/guardian.entity.js';
import { Resident } from '../residents/entities/resident.entity.js';
import { StaffMember } from '../staff/entities/staff-member.entity.js';
import { FeedbackController } from './controllers/feedback.controller.js';
import { UserFeedback } from './entities/user-feedback.entity.js';
import { FeedbackService } from './services/feedback.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserFeedback, StaffMember, Guardian, Resident]),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
