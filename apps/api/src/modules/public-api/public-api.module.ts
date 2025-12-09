import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { StatisticsModule } from '../statistics/statistics.module';

@Module({
  imports: [PrismaModule, StatisticsModule],
  controllers: [PublicApiController],
  providers: [ApiKeyGuard],
  exports: [ApiKeyGuard],
})
export class PublicApiModule {}
