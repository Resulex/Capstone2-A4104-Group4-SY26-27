import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { forbiddenError, unauthorizedError } from '../../../shared/errors';
import { verifyToken } from '../../../shared/auth';
import { readCookie, SESSION_COOKIE_NAME } from '../../../shared/cookies';

/**
 * Auth — Resident WebSocket token
 * Use-case: hand the resident session JWT to the frontend so it can open an
 * authenticated WebSocket (`?token=<jwt>`). The JWT lives in the httpOnly
 * `kbc_token` cookie, which client-side JS cannot read directly.
 * GET /auth/resident/ws-token (cookie-authenticated)
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

  // Signature + `exp` (throws 401), then the portal's own role, so an admin
  // session can never mint a resident WebSocket token.
  const payload = verifyToken(token);
  if (payload.role !== 'resident') {
    throw forbiddenError('This session does not belong to a resident.');
  }

  const response = ok({ token }, 'WS token.');
  response.headers = { ...response.headers, 'Cache-Control': 'no-store' };
  return response;
}

export const handler = withErrorHandling(handleWsToken);
