import type { NextResponse } from "next/server";

/**
 * Definition of the `kbc_token` session cookie, shared by the route handlers
 * that set, clear, and validate it.
 *
 * SERVER ONLY. This module reads non-public environment variables and is
 * imported by `app/api/**` route handlers only — never from a client
 * component. (The `NextResponse` import above is type-only, so this module
 * carries no runtime dependency on `next/server`.)
 */

/** Cookie name holding the session JWT. */
export const SESSION_COOKIE = "kbc_token";

/** Fallback lifetime: 7 days, matching the backend's default `JWT_EXPIRES_IN`. */
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Cookie lifetime in seconds.
 *
 * Configurable so it can be kept in step with the backend's `JWT_EXPIRES_IN`.
 * A cookie outliving its token is no longer a trap — `/api/auth/me` verifies
 * the token and clears the cookie — but the two should still agree.
 */
export function sessionMaxAgeSeconds(): number {
  const raw = process.env.SESSION_COOKIE_MAX_AGE_SECONDS;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_MAX_AGE_SECONDS;
}

/**
 * Whether the cookie carries the `Secure` attribute.
 *
 * Driven by an explicit `COOKIE_SECURE` env var rather than `NODE_ENV`:
 * `next start` and Amplify both set `NODE_ENV=production` even when the app is
 * reached over plain HTTP (e.g. a LAN IP during device testing), and browsers
 * silently DROP a `Secure` cookie there — the login POST reports success and
 * the very next request looks logged out.
 *
 * Unset keeps the previous `NODE_ENV` behaviour, so existing deployments are
 * unchanged. Set `COOKIE_SECURE=false` to test over HTTP and `true` to force
 * it on.
 */
export function sessionCookieSecure(): boolean {
  const explicit = process.env.COOKIE_SECURE;
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return process.env.NODE_ENV === "production";
}

/**
 * Attributes for writing or clearing the session cookie. Clearing must reuse
 * the same `path` (and any future `domain`) as the write, or the browser keeps
 * the original cookie and the session appears to survive logout.
 */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: sessionCookieSecure(),
    path: "/",
    maxAge,
  };
}

/**
 * Clears the session cookie on a response.
 *
 * Used both by the explicit logout route and by `/api/auth/me` when the
 * backend rejects the token, so a bad cookie is disposed of instead of being
 * re-sent on every subsequent request.
 */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
