import { Module } from '@nestjs/common';
import { CobrowseController } from './cobrowse.controller';
import { CobrowseService } from './cobrowse.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CobrowseController],
  providers: [CobrowseService],
  exports: [CobrowseService],
})
export class CobrowseModule {}
