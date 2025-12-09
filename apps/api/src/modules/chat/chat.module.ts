import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { ChatController } from './chat.controller';
import { ScenarioModule } from '../scenario/scenario.module';
import { NotificationModule } from '../notification/notification.module';
import { AiModule } from '../ai/ai.module';
import { LmsModule } from '../lms/lms.module';

@Module({
  imports: [ScenarioModule, NotificationModule, AiModule, LmsModule],
  providers: [ChatGateway, ChatService, ConversationService, MessageService],
  controllers: [ChatController],
  exports: [ChatService, ConversationService, MessageService],
})
export class ChatModule {}
