import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { SchoolAttendanceController } from './attendance.controller';
import { SchoolAttendanceService } from './attendance.service';
import { GradingController } from './grading.controller';
import { GradingService } from './grading.service';
import { SchoolFeesController } from './invoices.controller';
import { SchoolFeesService } from './invoices.service';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';
import { SchoolStaffController } from './staff.controller';
import { SchoolStaffService } from './staff.service';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { SchoolAnalyticsController } from './analytics.controller';
import { SchoolAnalyticsService } from './analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ClassesController,
    StudentsController,
    SchoolAttendanceController,
    GradingController,
    SchoolFeesController,
    TimetableController,
    SchoolStaffController,
    ParentController,
    AnnouncementsController,
    SchoolAnalyticsController,
  ],
  providers: [
    ClassesService,
    StudentsService,
    SchoolAttendanceService,
    GradingService,
    SchoolFeesService,
    TimetableService,
    SchoolStaffService,
    ParentService,
    AnnouncementsService,
    SchoolAnalyticsService,
  ],
  exports: [
    ClassesService,
    StudentsService,
    SchoolAttendanceService,
    GradingService,
    SchoolFeesService,
    TimetableService,
    SchoolStaffService,
    ParentService,
    AnnouncementsService,
  ],
})
export class SchoolModule {}
