import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import mongoose from 'mongoose';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { unauthorizedError } from '../../../shared/errors';
import { verifyToken } from '../../../shared/auth';
import { Admin, AdminConnection, ResidentConnection } from '../../../models';

type WsEvent = APIGatewayProxyEvent & {
  requestContext: { connectionId?: string };
};

/**
 * WebSocket — $connect
 * Use-case: register a live admin connection so the backend can push real-time
 * notifications to that admin's socket(s).
 * Authenticates via `?token=<JWT>` (the admin session JWT) and stores an
 * AdminConnection row keyed by the API Gateway connection id.
 */
async function handleConnect(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const wsEvent = event as WsEvent;
  const token = event.queryStringParameters?.token;
  if (!token) {
    throw unauthorizedError('Missing token.');
  }

  const payload = verifyToken(token);
  const connectionId = wsEvent.requestContext?.connectionId;
  if (!connectionId) {
    throw unauthorizedError('Missing connection id.');
  }

  await connectToDatabase();

  if (payload.role === 'admin') {
    const admin = await Admin.findOne({ adminId: payload.sub })
      .select('_id adminId')
      .lean();
    const adminId = admin
      ? admin._id
      : mongoose.isValidObjectId(payload.sub)
        ? new mongoose.Types.ObjectId(payload.sub)
        : null;
    if (!adminId) {
      throw unauthorizedError('Unknown administrator.');
    }
    await AdminConnection.updateOne(
      { connectionId },
      { $set: { connectionId, adminId, connectedAt: new Date() } },
      { upsert: true }
    );
    return ok({ connected: true }, 'Connected.');
  }

  if (payload.role === 'resident') {
    // The resident JWT `sub` is the Resident `_id`.
    if (!mongoose.isValidObjectId(payload.sub)) {
      throw unauthorizedError('Unknown resident.');
    }
    const residentId = new mongoose.Types.ObjectId(payload.sub);
    await ResidentConnection.updateOne(
      { connectionId },
      { $set: { connectionId, residentId, connectedAt: new Date() } },
      { upsert: true }
    );
    return ok({ connected: true }, 'Connected.');
  }

  throw unauthorizedError('Unknown role.');
}

export const handler = withErrorHandling(handleConnect);
