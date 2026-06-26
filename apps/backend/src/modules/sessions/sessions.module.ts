import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { CourseSession } from './entities/course-session.entity';
import { SessionMoment } from './entities/session-moment.entity';
import { SessionAttendee } from './entities/session-attendee.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseSession, SessionMoment, SessionAttendee]),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
