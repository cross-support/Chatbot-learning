import { Module } from '@nestjs/common';
import { AbTestController } from './abtest.controller';
import { AbTestService } from './abtest.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AbTestController],
  providers: [AbTestService],
  exports: [AbTestService],
})
export class AbTestModule {}
