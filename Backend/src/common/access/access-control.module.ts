import { Global, Module } from '@nestjs/common';
import { AccessGuard } from '../guards/access.guard';
import { AccessControlService } from './access-control.service';

/**
 * Global wiring for tenant/branch access control so any feature module can
 * inject AccessControlService or reference AccessGuard without imports.
 */
@Global()
@Module({
  providers: [AccessControlService, AccessGuard],
  exports: [AccessControlService, AccessGuard],
})
export class AccessControlModule {}
