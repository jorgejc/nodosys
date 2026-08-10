import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuxiliaryFunction } from './entities/auxiliary-function.entity';
import { ParticipationType } from './entities/participation-type.entity';
import { AuxiliaryDay } from './entities/auxiliary-day.entity';
import { AuxiliaryActivity } from './entities/auxiliary-activity.entity';
import { AuxiliaryDailyLog } from './entities/auxiliary-daily-log.entity';
import { AuxiliaryActivityParticipation } from './entities/auxiliary-activity-participation.entity';
import { AuxiliaryEvidence } from './entities/auxiliary-evidence.entity';
import { ActivityRequest } from '../activities/entities/activity-request.entity';
import { Process } from '../processes/entities/process.entity';
import { Nodo } from '../nodos/entities/nodo.entity';
import { User } from '../users/entities/user.entity';
import { AuxiliaryService } from './auxiliary.service';
import { AuxiliaryController } from './auxiliary.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuxiliaryFunction, ParticipationType,
      AuxiliaryDay, AuxiliaryActivity, AuxiliaryEvidence,
      // Legacy: el modelo viejo se conserva hasta que la migracion lleve
      // tiempo verificada en produccion. Ya no se escribe.
      AuxiliaryDailyLog, AuxiliaryActivityParticipation,
      // Solo lectura: para validar que la actividad/proceso al que se
      // engancha un evento pertenece de verdad al nodo del auxiliar.
      ActivityRequest, Process, Nodo,
      User,
    ]),
  ],
  providers: [AuxiliaryService],
  controllers: [AuxiliaryController],
  // ReportsModule lo importa para reusar el control de acceso al generar
  // el reporte mensual.
  exports: [AuxiliaryService],
})
export class AuxiliaryModule {}
