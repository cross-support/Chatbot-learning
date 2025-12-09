import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SessionService } from '../../common/services/session.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService, SessionService],
  exports: [AdminService],
})
export class AdminModule {}
