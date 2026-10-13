import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

const HASH_OPTIONS = { type: argon2.argon2id } as const;

@Injectable()
export class PasswordService {
  private readonly placeholderHash = argon2.hash(
    'placeholder-for-accounts-without-password',
    HASH_OPTIONS,
  );

  hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }

  async verify(
    passwordHash: string | null | undefined,
    password: string,
  ): Promise<boolean> {
    // Contas inexistentes ou ainda sem senha pagam o custo de uma verificação
    // real, para que o tempo de resposta não revele quais e-mails existem.
    const hashToCheck = passwordHash ?? (await this.placeholderHash);
    const matches = await argon2
      .verify(hashToCheck, password)
      .catch(() => false);
    return Boolean(passwordHash) && matches;
  }
}
