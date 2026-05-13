import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryUnit } from '../inventory/entities/inventory-unit.entity';
import { WorkPlan } from '../workplan/entities/work-plan.entity';
import { WorkPlanAxis } from '../workplan/entities/work-plan-axis.entity';
import { AxisActivity } from '../workplan/entities/axis-activity.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem, InventoryUnit,
      WorkPlan, WorkPlanAxis, AxisActivity,
    ]),
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
