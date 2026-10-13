import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { ValueTransformer } from 'typeorm';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const FORMAT_VERSION = 'v1';

function readKey(): Buffer {
  const encodedKey = process.env.CPF_ENCRYPTION_KEY;
  if (!encodedKey) throw new Error('CPF_ENCRYPTION_KEY is not set');
  return Buffer.from(encodedKey, 'base64');
}

/** Stored as `v1:<iv>:<auth tag>:<ciphertext>` (base64), so the format can evolve. */
export function encryptField(plaintext: string, key = readKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return [
    FORMAT_VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptField(stored: string, key = readKey()): string {
  const [version, iv, authTag, ciphertext] = stored.split(':');
  if (version !== FORMAT_VERSION || !iv || !authTag || !ciphertext) {
    throw new Error('Unsupported encrypted field format');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export const encryptedColumn: ValueTransformer = {
  to: (value: string | null | undefined) =>
    value == null ? value : encryptField(value),
  from: (value: string | null) => (value == null ? value : decryptField(value)),
};
