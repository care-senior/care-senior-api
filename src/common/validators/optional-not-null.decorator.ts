import { ValidateIf } from 'class-validator';

/**
 * Like `@IsOptional()`, but only an absent field skips validation: an
 * explicit `null` still runs the other validators. For PATCH fields whose
 * column is NOT NULL.
 */
export function IsOptionalNotNull(): PropertyDecorator {
  return ValidateIf((_object, value: unknown) => value !== undefined);
}
