import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityRequest } from './entities/activity-request.entity';
import { ActivityExpense } from './entities/activity-expense.entity';
import { ActivityParticipant } from './entities/activity-participant.entity';
import { ActivityEvidence } from './entities/activity-evidence.entity';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActivityRequest, ActivityExpense,
      ActivityParticipant, ActivityEvidence,
    ]),
  ],
  providers: [ActivitiesService],
  controllers: [ActivitiesController],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
