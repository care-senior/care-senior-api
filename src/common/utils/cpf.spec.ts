import { isValidCpf, maskCpf, normalizeCpf } from './cpf.js';

describe('cpf', () => {
  it('normalizes to digits only', () => {
    expect(normalizeCpf('123.456.789-09')).toBe('12345678909');
  });

  it.each(['123.456.789-09', '52998224725', '529.982.247-25'])(
    'accepts %s',
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(true);
    },
  );

  it.each(['123.456.789-00', '111.111.111-11', '1234567890', ''])(
    'rejects %s',
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    },
  );

  it('masks everything but the check digits', () => {
    expect(maskCpf('52998224725')).toBe('•••.•••.•••-25');
    expect(maskCpf(null)).toBeNull();
    expect(maskCpf('not-a-cpf')).toBeNull();
  });
});
