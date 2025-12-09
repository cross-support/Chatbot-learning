import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from '../../common/services/session.service';

@Module({
  controllers: [SessionController],
  providers: [SessionService],
})
export class SessionModule {}
