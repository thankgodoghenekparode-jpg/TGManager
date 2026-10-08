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

@Module({
  imports: [PrismaModule],
  controllers: [
    ClassesController,
    StudentsController,
    SchoolAttendanceController,
    GradingController,
    SchoolFeesController,
  ],
  providers: [
    ClassesService,
    StudentsService,
    SchoolAttendanceService,
    GradingService,
    SchoolFeesService,
  ],
  exports: [
    ClassesService,
    StudentsService,
    SchoolAttendanceService,
    GradingService,
    SchoolFeesService,
  ],
})
export class SchoolModule {}
