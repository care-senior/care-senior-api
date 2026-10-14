import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { CLIENT_PLATFORM_HEADER } from './modules/auth/utils/refresh-token-cookie.js';
import type { Environment } from './config/environment.js';
import { configureApp, DOCS_PATH } from './configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  const trustedProxies = config.get('TRUST_PROXY', { infer: true });
  if (trustedProxies > 0) app.set('trust proxy', trustedProxies);
  configureApp(app);
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', CLIENT_PLATFORM_HEADER],
    credentials: true,
  });

  const documentConfig = new DocumentBuilder()
    .setTitle('Care Senior API')
    .setDescription('API do Care Senior — app mobile e web app administrativo')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup(DOCS_PATH, app, document);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
