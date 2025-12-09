import { Module } from '@nestjs/common';
import { IpWhitelistController } from './ip-whitelist.controller';
import { IpWhitelistService } from './ip-whitelist.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IpWhitelistController],
  providers: [IpWhitelistService],
  exports: [IpWhitelistService],
})
export class IpWhitelistModule {}
