import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { unauthorizedError } from './errors';

/**
 * Signed, stateless OAuth `state` for the resident Google SSO popup flow.
 *
 * Why not a cookie: Google navigates the popup straight to the *backend*
 * callback URL, which in production lives on the API Gateway domain — a
 * different origin from the Amplify-hosted frontend. A `state` cookie written
 * on the frontend origin would never be sent to the callback, so cookie-based
 * state validation cannot work here. Signing the value with the app secret
 * gives tamper-proof, replay-windowed state with no shared storage (which also
 * matters because `serverless-esbuild` bundles every function separately, so
 * an in-memory Map would not be visible across Lambdas).
 *
 * Scope: this proves the callback was started by this app and is recent. It
 * does NOT bind the callback to the browser that began the flow — that binding
 * is done by the opener window comparing the returned `state` against the value
 * it stored when it opened the popup (see the login page's `message` handler).
 */

/** How long a `state` value stays valid. */
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Signing key for `state` values. Prefers a dedicated secret so the value can
 * be rotated independently of session tokens; falls back to `JWT_SECRET` (the
 * same default as `shared/auth.ts`) so no new env var is required to deploy.
 */
function stateSecret(): string {
  return (
    process.env.OAUTH_STATE_SECRET ||
    process.env.JWT_SECRET ||
    'dev-secret-do-not-use-in-prod'
  );
}

export interface OAuthState {
  /** Random nonce, unique per authorization attempt. */
  n: string;
  /** Creation time (epoch ms). */
  t: number;
}

/** Mints a fresh signed `state` value for a Google authorization URL. */
export function createOAuthState(): string {
  const payload: OAuthState = {
    n: randomBytes(16).toString('hex'),
    t: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const tag = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${tag}`;
}

/**
 * Verifies a `state` value echoed back by Google and returns its payload.
 * Throws a 401 AppError when the value is missing, malformed, tampered with,
 * or older than {@link STATE_TTL_MS}.
 */
export function verifyOAuthState(state: unknown): OAuthState {
  if (typeof state !== 'string' || state.length === 0) {
    throw unauthorizedError('Missing OAuth state.');
  }

  const dot = state.indexOf('.');
  if (dot <= 0) {
    throw unauthorizedError('Invalid OAuth state.');
  }

  const body = state.slice(0, dot);
  const tag = state.slice(dot + 1);
  const expected = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');

  // Constant-time compare; bail early if the lengths differ since
  // timingSafeEqual throws on mismatched buffer sizes.
  const provided = Buffer.from(tag);
  const computed = Buffer.from(expected);
  if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
    throw unauthorizedError('Invalid OAuth state.');
  }

  let payload: OAuthState;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthState;
  } catch {
    throw unauthorizedError('Invalid OAuth state.');
  }

  if (typeof payload?.n !== 'string' || typeof payload?.t !== 'number') {
    throw unauthorizedError('Invalid OAuth state.');
  }
  if (Date.now() - payload.t > STATE_TTL_MS) {
    throw unauthorizedError('Expired OAuth state. Please start the sign-in again.');
  }

  return payload;
}
