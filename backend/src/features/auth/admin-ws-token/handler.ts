import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { forbiddenError, unauthorizedError } from '../../../shared/errors';
import { verifyToken } from '../../../shared/auth';
import { readCookie, SESSION_COOKIE_NAME } from '../../../shared/cookies';

/**
 * Auth — Admin WebSocket token
 * Use-case: hand the admin session JWT to the frontend so it can open an
 * authenticated WebSocket (`?token=<jwt>`). The JWT lives in the httpOnly
 * `kbc_token` cookie, which client-side JS cannot read directly.
 * GET /auth/admin/ws-token (cookie-authenticated)
 *
 * The cookie value is verified here before it is handed back: the cookie is
 * httpOnly, but that only stops the client reading it — not an expired,
 * forged, or wrong-portal token being echoed straight back.
 */
async function handleWsToken(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const token = readCookie(event, SESSION_COOKIE_NAME);
  if (!token) {
    throw unauthorizedError('No session token.');
  }

  // Signature + `exp` (throws 401), then the portal's own role, so a resident
  // session can never mint an admin WebSocket token.
  const payload = verifyToken(token);
  if (payload.role !== 'admin') {
    throw forbiddenError('This session does not belong to an administrator.');
  }

  const response = ok({ token }, 'WS token.');
  response.headers = { ...response.headers, 'Cache-Control': 'no-store' };
  return response;
}

export const handler = withErrorHandling(handleWsToken);
