import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { AdminConnection, ResidentConnection } from '../../../models';

type WsEvent = APIGatewayProxyEvent & {
  requestContext: { connectionId?: string };
};

/**
 * WebSocket — $disconnect
 * Use-case: forget a closed admin connection so the backend stops pushing to a
 * dead socket.
 */
async function handleDisconnect(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const connectionId = (event as WsEvent).requestContext?.connectionId;
  if (connectionId) {
    await connectToDatabase();
    // The connection may belong to an admin or a resident — clean up both.
    await AdminConnection.deleteOne({ connectionId });
    await ResidentConnection.deleteOne({ connectionId });
  }
  return ok({ disconnected: true }, 'Disconnected.');
}

export const handler = withErrorHandling(handleDisconnect);
