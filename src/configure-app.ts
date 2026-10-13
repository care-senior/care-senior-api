import {
  ValidationPipe,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';

export const API_PREFIX = 'api';
export const API_VERSION = '1';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use(cookieParser());
}
