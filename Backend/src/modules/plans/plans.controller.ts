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
    summary: 'List plans and pricing',
    description:
      'Returns the 3-tier pricing catalog (features, limits, billing) served to the pricing page.',
  })
  @ApiOkResponse({ description: 'Pricing catalog.' })
  listPlans() {
    return this.plansService.getCatalog();
  }
}
