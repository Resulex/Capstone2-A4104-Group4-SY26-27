import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { unauthorizedError } from './errors';

/**
 * Google SSO `state` — the CSRF token that ties a callback to the sign-in that
 * started it.
 *
 * It is minted here as a short-lived, HMAC-signed JWT and carried through
 * Google's redirect. It is deliberately NOT cookie-backed: the callback is
 * navigated to the backend origin by Google, which differs from the frontend
 * origin in production, so a cookie set by the start route may not be sent
 * back. Nothing secret lives inside the value — the signature is what makes it
 * unforgeable, and the short TTL bounds replay.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod';
const STATE_TTL = '10m';
const STATE_PURPOSE = 'oauth-state';

interface OAuthStatePayload {
  purpose: string;
  nonce: string;
}

/**
 * Mints a signed `state` value for a new sign-in attempt. The random nonce
 * keeps two attempts from ever producing the same token.
 */
export function createOAuthState(): string {
  const payload: OAuthStatePayload = {
    purpose: STATE_PURPOSE,
    nonce: randomUUID(),
  };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: STATE_TTL as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Validates the `state` Google echoed back. Throws a 401 AppError when it is
 * missing, unsigned, signed with a different key, minted for another purpose,
 * or past its short TTL — i.e. whenever the callback cannot be tied to a
 * sign-in this backend started.
 */
export function verifyOAuthState(state: string | undefined): void {
  if (!state) {
    throw unauthorizedError('Missing Google sign-in state.');
  }
  try {
    const decoded = jwt.verify(state, JWT_SECRET);
    if (typeof decoded === 'string' || decoded.purpose !== STATE_PURPOSE) {
      throw new Error('Not an OAuth state token.');
    }
  } catch {
    throw unauthorizedError('Invalid or expired Google sign-in state.');
  }
}
