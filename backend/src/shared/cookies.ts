import type { APIGatewayProxyEvent } from 'aws-lambda';

/**
 * Cookie helpers shared by the handlers that read the session cookie directly.
 *
 * Most protected endpoints receive the JWT through the `Authorization` header
 * (injected by the frontend proxy), but the WebSocket token routes read the
 * httpOnly `kbc_token` cookie straight off the event.
 */

/** Name of the httpOnly session cookie holding the app JWT. */
export const SESSION_COOKIE_NAME = 'kbc_token';

/**
 * Reads a cookie value from an API Gateway event.
 *
 * API Gateway lowercases header names, but `Cookie` is tolerated for direct
 * (in-process/test) invocations. A malformed percent-escape is treated as "no
 * cookie" rather than allowed to throw: `decodeURIComponent` raises a URIError
 * on input like `%E0%A4%A`, which would surface as a 500 (plus an error log)
 * instead of the correct 401 — letting an attacker generate noisy failures
 * from a single header.
 */
export function readCookie(
  event: APIGatewayProxyEvent,
  name: string = SESSION_COOKIE_NAME
): string | null {
  const header = event.headers?.cookie ?? event.headers?.Cookie ?? '';
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(header);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
