import { Module } from '@nestjs/common';
import { RichMessageController } from './rich-message.controller';
import { RichMessageService } from './rich-message.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RichMessageController],
  providers: [RichMessageService],
  exports: [RichMessageService],
})
export class RichMessageModule {}
