import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet());
  app.use(cookieParser());

  // CORS設定
  const corsOrigins = configService.get<string>('CORS_ORIGINS')?.split(',') || [];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

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

  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║                                                      ║
  ║   🤖 CrossBot API Server                             ║
  ║                                                      ║
  ║   Server running on: http://localhost:${port}          ║
  ║   Swagger docs: http://localhost:${port}/api/docs      ║
  ║                                                      ║
  ╚══════════════════════════════════════════════════════╝
  `);
}
bootstrap();
