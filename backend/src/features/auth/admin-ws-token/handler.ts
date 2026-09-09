import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { unauthorizedError } from '../../../shared/errors';

/** Reads a cookie value from an API Gateway event (header names are lowercased). */
function readCookie(event: APIGatewayProxyEvent, name: string): string | null {
  const header = event.headers?.cookie ?? event.headers?.Cookie ?? '';
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(header);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Auth — Admin WebSocket token
 * Use-case: hand the admin session JWT to the frontend so it can open an
 * authenticated WebSocket (`?token=<jwt>`). The JWT lives in the httpOnly
 * `kbc_token` cookie, which client-side JS cannot read directly.
 * GET /auth/admin/ws-token (cookie-authenticated)
 */
async function handleWsToken(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const token = readCookie(event, 'kbc_token');
  if (!token) {
    throw unauthorizedError('No session token.');
  }
  return ok({ token }, 'WS token.');
}

export const handler = withErrorHandling(handleWsToken);
