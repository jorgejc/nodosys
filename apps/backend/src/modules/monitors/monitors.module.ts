import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitorWorkPlan } from './entities/monitor-work-plan.entity';
import { MonitorWeek } from './entities/monitor-week.entity';
import { MonitorWeekActivity } from './entities/monitor-week-activity.entity';
import { MonitorEvidence } from './entities/monitor-evidence.entity';
import { User } from '../users/entities/user.entity';
import { MonitorsService } from './monitors.service';
import { MonitorsController } from './monitors.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MonitorWorkPlan, MonitorWeek, MonitorWeekActivity, MonitorEvidence, User,
    ]),
  ],
  providers: [MonitorsService],
  controllers: [MonitorsController],
  // ReportsModule lo importa para reusar el control de acceso al generar
  // el Excel del plan y el certificado de horas.
  exports: [MonitorsService],
})
export class MonitorsModule {}
