import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ValidateBy } from 'class-validator';
import { isValidCpf, normalizeCpf } from '../utils/cpf.js';

/** Accepts a CPF with or without punctuation and stores it as 11 digits. */
export const IsCpf = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizeCpf(value) : value,
    ),
    ValidateBy({
      name: 'isCpf',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidCpf(value),
        defaultMessage: () => 'cpf must be a valid CPF',
      },
    }),
  );
