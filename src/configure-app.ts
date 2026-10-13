import {
  RequestMethod,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';

export const API_PREFIX = 'api/v1';
export const DOCS_PATH = 'api/docs';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [{ path: '/', method: RequestMethod.GET }],
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
