import { Module } from '@nestjs/common';
import { SeedOnBootstrapService } from './seed-on-bootstrap.service';

@Module({
  providers: [SeedOnBootstrapService],
  exports: [SeedOnBootstrapService],
})
export class SeedModule {}
