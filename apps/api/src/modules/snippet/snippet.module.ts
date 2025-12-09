import { Module } from '@nestjs/common';
import { SnippetController } from './snippet.controller';
import { SnippetService } from './snippet.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SnippetController],
  providers: [SnippetService],
  exports: [SnippetService],
})
export class SnippetModule {}
