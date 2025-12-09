import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { TeamsService } from './teams.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SlackService, TeamsService],
  exports: [SlackService, TeamsService],
})
export class IntegrationsModule {}
