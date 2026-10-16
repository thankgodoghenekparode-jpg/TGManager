import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CbtAttemptsController } from './cbt-attempts.controller';
import { CbtAttemptsService } from './cbt-attempts.service';
import { CbtAnalyticsService } from './cbt-analytics.service';
import { CbtExamsController } from './cbt-exams.controller';
import { CbtExamsService } from './cbt-exams.service';
import { CbtQuestionsController } from './cbt-questions.controller';
import { CbtQuestionsService } from './cbt-questions.service';
import { CbtReportsController } from './cbt-reports.controller';

/**
 * Computer-Based Test (practice & mock examinations).
 *
 * Mounts every `/school/cbt/**` route. All access decisions happen server-side
 * through `@Permissions` + `AccessGuard`, and every query is tenant-scoped.
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    CbtQuestionsController,
    CbtExamsController,
    CbtAttemptsController,
    CbtReportsController,
  ],
  providers: [
    CbtQuestionsService,
    CbtExamsService,
    CbtAttemptsService,
    CbtAnalyticsService,
  ],
  exports: [CbtExamsService, CbtAttemptsService, CbtAnalyticsService],
})
export class CbtModule {}
