import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Environment } from './config/environment.js';
import { API_PREFIX, configureApp } from './configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  configureApp(app);
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });

  const documentConfig = new DocumentBuilder()
    .setTitle('Care Senior API')
    .setDescription('API do Care Senior — app mobile e web app administrativo')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
