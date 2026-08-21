import jwt from 'jsonwebtoken';
import { unauthorizedError } from './errors';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JwtPayload {
  sub: string; // user id
  role: string;
}

/**
 * Signs a JWT for a user.
 *
 * @param expiresIn Optional TTL. When omitted, the default `JWT_EXPIRES_IN`
 *   (7d) is used. Callers needing a short-lived token (e.g. TOTP enrollment)
 *   should pass an explicit value such as `'10m'`.
 */
export function signToken(
  userId: string,
  role: string,
  expiresIn?: string,
): string {
  const ttl = expiresIn || JWT_EXPIRES_IN;
  return jwt.sign({ sub: userId, role }, JWT_SECRET, {
    expiresIn: ttl as jwt.SignOptions['expiresIn'],
  });
}

/** Verifies a token and returns the payload, or throws a 401 AppError. */
export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new Error('Invalid token payload.');
    }
    return { sub: decoded.sub, role: decoded.role as string };
  } catch {
    throw unauthorizedError('Invalid or expired token.');
  }
}

/**
 * Extracts the Bearer token from an Authorization header value.
 * Returns null when absent or malformed.
 */
export function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader);
  return match ? match[1] : null;
}