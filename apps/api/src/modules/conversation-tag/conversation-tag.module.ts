import { Module } from '@nestjs/common';
import { ConversationTagController } from './conversation-tag.controller';
import { ConversationTagService } from './conversation-tag.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConversationTagController],
  providers: [ConversationTagService],
  exports: [ConversationTagService],
})
export class ConversationTagModule {}
