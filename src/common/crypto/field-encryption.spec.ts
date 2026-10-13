import { randomBytes } from 'node:crypto';
import { decryptField, encryptField } from './field-encryption.js';

describe('criptografia de campo', () => {
  const key = randomBytes(32);

  it('recupera o valor original', () => {
    expect(decryptField(encryptField('123.456.789-09', key), key)).toBe(
      '123.456.789-09',
    );
  });

  it('nunca gera o mesmo texto cifrado duas vezes', () => {
    expect(encryptField('123.456.789-09', key)).not.toBe(
      encryptField('123.456.789-09', key),
    );
  });

  it('falha com outra chave ou valor adulterado', () => {
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

  it('recusa formatos desconhecidos', () => {
    expect(() => decryptField('plain-cpf', key)).toThrow(
      'Unsupported encrypted field format',
    );
  });
});
