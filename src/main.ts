import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { CLIENT_PLATFORM_HEADER } from './auth/refresh-token-cookie.js';
import type { Environment } from './config/environment.js';
import { configureApp, DOCS_PATH } from './configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

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
