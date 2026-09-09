import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';

/**
 * WebSocket — $default
 * Use-case: inbound client messages are not used (push-only notifications), so
 * this is a no-op that keeps the connection alive.
 */
async function handleDefault(
  _event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  return ok({ message: 'No-op.' }, 'OK.');
}

export const handler = withErrorHandling(handleDefault);
