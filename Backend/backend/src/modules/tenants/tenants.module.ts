import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';

@Module({
  imports: [PlansModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
