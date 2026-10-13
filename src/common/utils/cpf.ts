const CPF_LENGTH = 11;

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

function checkDigit(digits: number[], weightStart: number): number {
  const sum = digits.reduce(
    (total, digit, index) => total + digit * (weightStart - index),
    0,
  );
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (cpf.length !== CPF_LENGTH || /^(\d)\1+$/.test(cpf)) return false;

  const digits = [...cpf].map(Number);
  return (
    checkDigit(digits.slice(0, 9), 10) === digits[9] &&
    checkDigit(digits.slice(0, 10), 11) === digits[10]
  );
}

/** Keeps only the two check digits visible: `•••.•••.•••-09`. */
export function maskCpf(value: string | null | undefined): string | null {
  if (!value) return null;
  const cpf = normalizeCpf(value);
  if (cpf.length !== CPF_LENGTH) return null;
  return `•••.•••.•••-${cpf.slice(-2)}`;
}
