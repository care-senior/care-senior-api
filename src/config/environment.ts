import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
  validateSync,
} from 'class-validator';

const DURATION = /^\d+[smhd]$/;
const BASE64_32_BYTES = /^[A-Za-z0-9+/]{43}=$/;

export class Environment {
  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @Transform(({ value }) => Number(value ?? 5432))
  @IsInt()
  DB_PORT = 5432;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @Matches(DURATION)
  JWT_ACCESS_TTL = '15m';

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @Matches(DURATION)
  JWT_REFRESH_TTL = '30d';

  @Transform(({ value }: { value?: string }) =>
    (value ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  @IsUrl({ require_tld: false }, { each: true })
  CORS_ORIGIN: string[] = [];

  @Transform(({ value }) => value !== 'false')
  @IsBoolean()
  COOKIE_SECURE = true;

  @IsString()
  @IsNotEmpty()
  SMTP_HOST!: string;

  @Transform(({ value }) => Number(value ?? 587))
  @IsInt()
  SMTP_PORT = 587;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsString()
  @IsNotEmpty()
  SMTP_FROM!: string;

  @IsUrl({ require_tld: false })
  PASSWORD_RESET_URL!: string;

  @IsUrl({ require_tld: false })
  STAFF_INVITE_URL!: string;

  @Matches(BASE64_32_BYTES, {
    message: 'CPF_ENCRYPTION_KEY must be 32 random bytes encoded in base64',
  })
  CPF_ENCRYPTION_KEY!: string;
}

export function validateEnvironment(raw: Record<string, unknown>): Environment {
  const environment = plainToInstance(Environment, raw, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(environment, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('\n  - ');
    throw new Error(`Invalid environment variables:\n  - ${details}`);
  }
  return environment;
}
