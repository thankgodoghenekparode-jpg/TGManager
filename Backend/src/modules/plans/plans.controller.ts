import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PlansService } from './plans.service';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List active plans',
    description:
      'Lists the active subscription plans available to new tenants.',
  })
  @ApiOkResponse({ description: 'List of active plans.' })
  async listPlans() {
    const plans = await this.plansService.listActive();
    return plans.map(({ maxStorageBytes, ...plan }) => ({
      ...plan,
      maxStorageBytes: maxStorageBytes?.toString() ?? null,
    }));
  }
}
