import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { JwtPayload } from '../../common/types/authenticated-request.interface';
import { AccountRequestsService } from './account-requests.service';
import {
  createEmailChangeSchema,
  type CreateEmailChangeDto,
} from './dto/account-request.dto';

@ApiTags('Account')
@Controller('account')
export class AccountController {
  constructor(private readonly requests: AccountRequestsService) {}

  @Post('email-change-request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit an email change request',
    description:
      'Creates a PENDING email change request for the authenticated user. ' +
      'The email is only changed after a super admin approves it. No account ' +
      'is changed immediately.',
  })
  @ApiBody({ schema: schemaRef('CreateEmailChangeDto') })
  @ApiCreatedResponse({ description: 'Email change request submitted.' })
  createEmailChange(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createEmailChangeSchema))
    dto: CreateEmailChangeDto,
  ) {
    return this.requests.createEmailChange(user.sub, dto);
  }

  @Get('requests')
  @ApiOperation({
    summary: 'List my account requests',
    description:
      'Returns the email change and password reset requests submitted by the ' +
      'authenticated customer, most recent first.',
  })
  @ApiOkResponse({ description: 'The customer’s account requests.' })
  listMyRequests(@CurrentUser() user: JwtPayload) {
    return this.requests.listMyRequests(user.sub);
  }
}
