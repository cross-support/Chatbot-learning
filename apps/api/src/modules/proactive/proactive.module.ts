import { Module } from '@nestjs/common';
import { ProactiveService } from './proactive.service';
import { ProactiveController } from './proactive.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProactiveController],
  providers: [ProactiveService],
  exports: [ProactiveService],
})
export class ProactiveModule {}
