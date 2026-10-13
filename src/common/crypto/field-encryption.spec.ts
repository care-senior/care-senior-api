import { randomBytes } from 'node:crypto';
import { decryptField, encryptField } from './field-encryption.js';

describe('field encryption', () => {
  const key = randomBytes(32);

  it('round-trips the value', () => {
    expect(decryptField(encryptField('123.456.789-09', key), key)).toBe(
      '123.456.789-09',
    );
  });

  it('never produces the same ciphertext twice', () => {
    expect(encryptField('123.456.789-09', key)).not.toBe(
      encryptField('123.456.789-09', key),
    );
  });

  it('fails with another key or a tampered value', () => {
    const stored = encryptField('123.456.789-09', key);
    const [version, iv, tag] = stored.split(':');

    expect(() => decryptField(stored, randomBytes(32))).toThrow();
    expect(() =>
      decryptField(
        `${version}:${iv}:${tag}:${Buffer.from('x').toString('base64')}`,
        key,
      ),
    ).toThrow();
  });

  it('rejects unknown formats', () => {
    expect(() => decryptField('plain-cpf', key)).toThrow(
      'Unsupported encrypted field format',
    );
  });
});
