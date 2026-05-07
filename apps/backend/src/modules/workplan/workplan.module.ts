import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkPlan } from './entities/work-plan.entity';
import { WorkPlanAxis } from './entities/work-plan-axis.entity';
import { AxisActivity } from './entities/axis-activity.entity';
import { WorkPlanService } from './workplan.service';
import { WorkPlanController } from './workplan.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkPlan, WorkPlanAxis, AxisActivity])],
  providers: [WorkPlanService],
  controllers: [WorkPlanController],
  exports: [WorkPlanService],
})
export class WorkPlanModule {}
