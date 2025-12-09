import { Module, Global } from '@nestjs/common';
import { SecurityLogService } from './services/security-log.service';
import { SessionService } from './services/session.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [SecurityLogService, SessionService],
  exports: [SecurityLogService, SessionService],
})
export class CommonModule {}
