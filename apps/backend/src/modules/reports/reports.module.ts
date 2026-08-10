import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryUnit } from '../inventory/entities/inventory-unit.entity';
import { WorkPlan } from '../workplan/entities/work-plan.entity';
import { WorkPlanAxis } from '../workplan/entities/work-plan-axis.entity';
import { AxisActivity } from '../workplan/entities/axis-activity.entity';
import { ActivityRequest } from '../activities/entities/activity-request.entity';
import { User } from '../users/entities/user.entity';
import { MonitorWorkPlan } from '../monitors/entities/monitor-work-plan.entity';
import { MonitorWeek } from '../monitors/entities/monitor-week.entity';
import { MonitorWeekActivity } from '../monitors/entities/monitor-week-activity.entity';
import { MonitorsModule } from '../monitors/monitors.module';
import { AuxiliaryModule } from '../auxiliary/auxiliary.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem, InventoryUnit,
      WorkPlan, WorkPlanAxis, AxisActivity,
      ActivityRequest, User,
      MonitorWorkPlan, MonitorWeek, MonitorWeekActivity,
    ]),
    // Reusa el control de acceso de monitorías (rol + aislamiento por nodo)
    MonitorsModule,
    // Ídem para el registro de actividad del auxiliar
    AuxiliaryModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
