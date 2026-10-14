import { Transform } from 'class-transformer';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  );
