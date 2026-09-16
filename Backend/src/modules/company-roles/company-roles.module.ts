import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CompanyRolesController } from './company-roles.controller';
import { CompanyRolesService } from './company-roles.service';

@Module({
  imports: [AuditModule],
  controllers: [CompanyRolesController],
  providers: [CompanyRolesService],
  exports: [CompanyRolesService],
})
export class CompanyRolesModule {}
