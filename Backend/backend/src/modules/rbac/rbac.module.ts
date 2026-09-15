import { Global, Module } from '@nestjs/common';
import { AbilitiesService } from './abilities/abilities.service';
import { PermissionsController } from './permissions/permissions.controller';

@Global()
@Module({
  controllers: [PermissionsController],
  providers: [AbilitiesService],
  exports: [AbilitiesService],
})
export class RbacModule {}
