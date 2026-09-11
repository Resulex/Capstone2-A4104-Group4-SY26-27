import { createHash, randomBytes } from 'node:crypto';

/**
 * Opaque, single-use tokens for the admin password-reset link.
 *
 * Only the SHA-256 hash is persisted (on the Admin document), so a database
 * leak cannot be replayed into a working reset link. The raw token exists only
 * long enough to build the URL and to be hashed again on the way back in.
 *
 * This replaces Cognito's `ForgotPassword`/`ConfirmForgotPassword` codes: the
 * link no longer has to carry a Cognito code, so the backend can render the
 * email itself (see `shared/email.ts`) and control expiry.
 */

/** How long a reset link stays valid. */
export const RESET_TOKEN_TTL_MINUTES = 60;

/** 32 random bytes → 43 url-safe characters. Regenerated on every request. */
export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Stable hash used for storage and lookup (hex SHA-256). */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The moment a token issued now stops working. */
export function resetTokenExpiry(now: number = Date.now()): Date {
  return new Date(now + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}

/**
 * Absolute URL the admin clicks in the email. `email` rides along purely so the
 * reset page can name the account — the token is the only credential.
 */
export function buildResetUrl(baseUrl: string, token: string, email: string): string {
  const url = new URL('/admin/reset-password', baseUrl);
  url.searchParams.set('token', token);
  url.searchParams.set('email', email);
  return url.toString();
}
