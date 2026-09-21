import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { PushModule } from '../push/push.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [PlansModule, PushModule],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
  exports: [ChatGateway, ChatService],
})
export class ChatModule {}
