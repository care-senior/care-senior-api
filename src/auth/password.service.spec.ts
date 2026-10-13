import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hashes with argon2id and verifies the password', async () => {
    const hash = await passwords.hash('correct-horse-battery');

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(passwords.verify(hash, 'correct-horse-battery')).resolves.toBe(
      true,
    );
    await expect(passwords.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('never accepts an account without password', async () => {
    await expect(
      passwords.verify(null, 'placeholder-for-accounts-without-password'),
    ).resolves.toBe(false);
    await expect(passwords.verify(undefined, 'anything')).resolves.toBe(false);
  });
});
