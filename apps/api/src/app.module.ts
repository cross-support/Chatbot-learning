import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { CacheModule } from './common/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ChatModule } from './modules/chat/chat.module';
import { ScenarioModule } from './modules/scenario/scenario.module';
import { UploadModule } from './modules/upload/upload.module';
import { NotificationModule } from './modules/notification/notification.module';
import { TemplateModule } from './modules/template/template.module';
import { AdminModule } from './modules/admin/admin.module';
import { SettingsModule } from './modules/settings/settings.module';
import { LmsModule } from './modules/lms/lms.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { BackupModule } from './modules/backup/backup.module';
import { ExportModule } from './modules/export/export.module';
import { AuditModule } from './modules/audit/audit.module';
import { AlertModule } from './modules/alert/alert.module';
import { RetentionModule } from './modules/retention/retention.module';
import { AttachmentModule } from './modules/attachment/attachment.module';
import { SurveyModule } from './modules/survey/survey.module';
import { InsightModule } from './modules/insight/insight.module';
import { ReportModule } from './modules/report/report.module';
import { TwoFactorModule } from './modules/two-factor/two-factor.module';
import { IpWhitelistModule } from './modules/ip-whitelist/ip-whitelist.module';
import { EncryptionModule } from './modules/encryption/encryption.module';
import { AssignmentModule } from './modules/assignment/assignment.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { LearningModule } from './modules/learning/learning.module';
import { RichMessageModule } from './modules/rich-message/rich-message.module';
import { CobrowseModule } from './modules/cobrowse/cobrowse.module';
import { ChannelModule } from './modules/channel/channel.module';
import { I18nModule } from './modules/i18n/i18n.module';
import { PreferenceModule } from './modules/preference/preference.module';
import { SnippetModule } from './modules/snippet/snippet.module';
import { ConversationTagModule } from './modules/conversation-tag/conversation-tag.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { SlaModule } from './modules/sla/sla.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SegmentModule } from './modules/segment/segment.module';
import { SessionModule } from './modules/session/session.module';
import { AbTestModule } from './modules/abtest/abtest.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { FaqModule } from './modules/faq/faq.module';
import { ApplicationModule } from './modules/application/application.module';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { ProactiveModule } from './modules/proactive/proactive.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // レート制限設定
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1秒
        limit: 10, // 1秒に10リクエストまで
      },
      {
        name: 'medium',
        ttl: 10000, // 10秒
        limit: 50, // 10秒に50リクエストまで
      },
      {
        name: 'long',
        ttl: 60000, // 1分
        limit: 100, // 1分に100リクエストまで
      },
    ]),
    PrismaModule,
    CommonModule,
    CacheModule,
    AuthModule,
    UserModule,
    ChatModule,
    ScenarioModule,
    UploadModule,
    NotificationModule,
    TemplateModule,
    AdminModule,
    SettingsModule,
    LmsModule,
    MonitoringModule,
    BackupModule,
    ExportModule,
    AuditModule,
    AlertModule,
    RetentionModule,
    AttachmentModule,
    SurveyModule,
    InsightModule,
    ReportModule,
    TwoFactorModule,
    IpWhitelistModule,
    EncryptionModule,
    AssignmentModule,
    SchedulerModule,
    LearningModule,
    RichMessageModule,
    CobrowseModule,
    ChannelModule,
    I18nModule,
    PreferenceModule,
    SnippetModule,
    ConversationTagModule,
    TransferModule,
    SlaModule,
    DashboardModule,
    SegmentModule,
    SessionModule,
    AbTestModule,
    StatisticsModule,
    WebhookModule,
    PublicApiModule,
    IntegrationsModule,
    FaqModule,
    ApplicationModule,
    ApiKeyModule,
    ProactiveModule,
  ],
  providers: [
    // グローバルにレート制限を適用
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
