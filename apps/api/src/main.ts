import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // ボディサイズ制限（シナリオ保存等で必要だが過度に大きくしない）
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // 画像のクロスオリジンアクセスを許可
  }));
  app.use(cookieParser());

  // CORS設定
  const corsOrigins = configService.get<string>('CORS_ORIGINS')?.split(',').filter(Boolean) || [];
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';

  app.enableCors({
    origin: corsOrigins.length > 0
      ? corsOrigins
      : nodeEnv === 'production'
        ? false // 本番環境ではCORS_ORIGINSが必須
        : true,  // 開発環境のみ全許可
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // グローバル例外フィルタ
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger設定
  const config = new DocumentBuilder()
    .setTitle('CrossBot API')
    .setDescription('EVA風チャットボット API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', '認証')
    .addTag('users', 'ユーザー管理')
    .addTag('conversations', '会話管理')
    .addTag('messages', 'メッセージ')
    .addTag('scenarios', 'シナリオ管理')
    .addTag('templates', 'テンプレート')
    .addTag('uploads', 'ファイルアップロード')
    .addTag('admins', '管理者')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);

  logger.log(`CrossBot API Server started on http://localhost:${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}
bootstrap();
