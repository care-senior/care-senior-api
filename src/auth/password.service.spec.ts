import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('gera hash argon2id e verifica a senha', async () => {
    const hash = await passwords.hash('correct-horse-battery');

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(passwords.verify(hash, 'correct-horse-battery')).resolves.toBe(
      true,
    );
    await expect(passwords.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('nunca aceita conta sem senha', async () => {
    await expect(
      passwords.verify(null, 'placeholder-for-accounts-without-password'),
    ).resolves.toBe(false);
    await expect(passwords.verify(undefined, 'anything')).resolves.toBe(false);
  });
});
