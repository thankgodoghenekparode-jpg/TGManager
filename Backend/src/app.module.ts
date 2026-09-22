import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { validateEnv } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PlatformRoleGuard } from './common/guards/platform-role.guard';
import { CsrfGuard } from './common/csrf/csrf.guard';
import { AccessControlModule } from './common/access/access-control.module';
import { MailerModule } from './common/mailer/mailer.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { PlansModule } from './modules/plans/plans.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CompanyRolesModule } from './modules/company-roles/company-roles.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { GroupsModule } from './modules/groups/groups.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { StaffModule } from './modules/staff/staff.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { MemosModule } from './modules/memos/memos.module';
import { FormsModule } from './modules/forms/forms.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { StorageModule } from './modules/storage/storage.module';
import { ReportsModule } from './modules/reports/reports.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PushModule } from './modules/push/push.module';
import { AuditModule } from './modules/audit/audit.module';
import { PlatformModule } from './modules/platform/platform.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AccountRequestsModule } from './modules/account-requests/account-requests.module';
import { WeeklyReportsModule } from './modules/weekly-reports/weekly-reports.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    MailerModule,
    AccessControlModule,
    UsersModule,
    PlansModule,
    TenantsModule,
    AuthModule,
    RbacModule,
    BranchesModule,
    DepartmentsModule,
    GroupsModule,
    StaffModule,
    CompanyRolesModule,
    SchedulesModule,
    AttendanceModule,
    MemosModule,
    FormsModule,
    DocumentsModule,
    InventoryModule,
    StorageModule,
    ReportsModule,
    WorkflowsModule,
    ChatModule,
    NotificationsModule,
    PushModule,
    AuditModule,
    PlatformModule,
    IntegrationsModule,
    SettingsModule,
    AccountRequestsModule,
    WeeklyReportsModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PlatformRoleGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
