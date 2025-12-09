import { Module, forwardRef } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { PublicSettingsController } from './public-settings.controller';
import { OffHoursInquiryController } from './off-hours-inquiry.controller';
import { ApiKeyController } from './api-key.controller';
import { WebhookController } from './webhook.controller';
import { SettingsService } from './settings.service';
import { ApiKeyService } from './api-key.service';
import { WebhookService } from './webhook.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, forwardRef(() => NotificationModule)],
  controllers: [
    SettingsController,
    PublicSettingsController,
    OffHoursInquiryController,
    ApiKeyController,
    WebhookController,
  ],
  providers: [SettingsService, ApiKeyService, WebhookService],
  exports: [SettingsService, ApiKeyService, WebhookService],
})
export class SettingsModule {}
