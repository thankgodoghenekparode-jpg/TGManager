import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { JwtPayload } from '../../common/types/authenticated-request.interface';
import {
  endpointSchema,
  subscriptionSchema,
  type EndpointDto,
  type SubscriptionDto,
} from './dto/push.dto';
import { PushService } from './push.service';

@ApiTags('Push')
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Public()
  @Get('vapid-public-key')
  @ApiOkResponse({
    description: 'VAPID public key used to subscribe this browser to Web Push.',
  })
  vapidPublicKey() {
    return { publicKey: this.push.getPublicKey() };
  }

  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Push subscription saved.' })
  async subscribe(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(subscriptionSchema)) dto: SubscriptionDto,
    @Req() req: Request,
  ) {
    const tenantId = String(req.headers['x-tenant-id'] ?? '');
    return this.push.saveSubscription(
      user.sub,
      tenantId,
      {
        endpoint: dto.subscription.endpoint,
        p256dh: dto.subscription.keys.p256dh,
        auth: dto.subscription.keys.auth,
      },
      req.headers['user-agent'],
    );
  }

  @Delete('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Push subscription removed.' })
  async unsubscribe(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(endpointSchema)) dto: EndpointDto,
  ) {
    await this.push.removeSubscription(user.sub, dto.endpoint);
  }
}