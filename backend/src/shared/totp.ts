import { generateSecret, generateURI, verify } from 'otplib';
import crypto from 'node:crypto';
import { unauthorizedError } from './errors';

const TOTP_ISSUER = process.env.TOTP_ISSUER || 'KaBarangayConnect';
// AES-256-GCM key (32 bytes / 64 hex chars) used to encrypt the TOTP secret at
// rest. In production this must be set and kept secret (KMS or env var).
const ENCRYPTION_KEY_HEX = process.env.TOTP_SECRET_ENCRYPTION_KEY || '';
const TOTP_ALGORITHM = 'aes-256-gcm';

/**
 * Generates a new TOTP secret (base32) for a given account label.
 * Returns the raw secret (shown only once) and an otpauth:// provisioning URI
 * used to render a QR code in Google Authenticator.
 */
export function generateTotpSecret(
  accountLabel: string
): { secret: string; otpauthUrl: string } {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: TOTP_ISSUER,
    label: accountLabel,
    secret,
    algorithm: 'sha1',
    digits: 6,
    period: 30,
  });
  return { secret, otpauthUrl };
}

/**
 * Verifies a user-supplied TOTP code against a stored (decrypted) base32 secret.
 * A small forward window is allowed to tolerate clock skew.
 */
export async function verifyTotp(
  code: string,
  secret: string
): Promise<boolean> {
  const result = await verify({
    token: code,
    secret,
    digits: 6,
    period: 30,
    epochTolerance: 1,
  });
  return result.valid;
}

/** Validates a supplied code against the stored secret, throwing 401 on failure. */
export async function assertValidTotp(
  code: string,
  secret: string
): Promise<void> {
  const ok = await verifyTotp(code, secret);
  if (!ok) {
    throw unauthorizedError('Invalid or expired authenticator code.');
  }
}

// ---------------------------------------------------------------------------
// Encryption at rest for the TOTP secret
// ---------------------------------------------------------------------------

/**
 * Encrypts the base32 TOTP secret with AES-256-GCM before storing it in Mongo.
 * Format: `iv:authTag:ciphertext` (all hex).
 */
export function encryptTotpSecret(plainSecret: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(TOTP_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainSecret, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
}

/**
 * Decrypts a stored TOTP secret back to its base32 form for verification.
 */
export function decryptTotpSecret(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, cipherHex] = encrypted.split(':');
  if (!ivHex || !authTagHex || !cipherHex) {
    throw unauthorizedError('Malformed stored authenticator secret.');
  }
  const decipher = crypto.createDecipheriv(
    TOTP_ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY_HEX) {
    throw new Error(
      'TOTP_SECRET_ENCRYPTION_KEY is not configured. Set a 32-byte hex key.'
    );
  }
  const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
  if (key.length !== 32) {
    throw new Error(
      'TOTP_SECRET_ENCRYPTION_KEY must be a 32-byte (64 hex char) AES-256 key.'
    );
  }
  return key;
}
