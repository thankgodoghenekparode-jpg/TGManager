import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlanLimitsService } from './plan-limits.service';
import { PlansController } from './plans.controller';

@Module({
  controllers: [PlansController],
  providers: [PlansService, PlanLimitsService],
  exports: [PlansService, PlanLimitsService],
})
export class PlansModule {}
