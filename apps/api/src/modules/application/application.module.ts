import { Module, Global } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { ApplicationController } from './application.controller';
import { PublicApplicationController } from './public-application.controller';

@Global()
@Module({
  providers: [ApplicationService],
  controllers: [ApplicationController, PublicApplicationController],
  exports: [ApplicationService],
})
export class ApplicationModule {}
