import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { AdminConnection, ResidentConnection } from '../models';

const REGION = process.env.AWS_REGION ?? 'ap-southeast-1';
const WS_ENDPOINT = process.env.WEBSOCKET_ENDPOINT ?? '';

/** Loopback management endpoints only make sense for `serverless offline`. */
const LOOPBACK_ENDPOINT = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

/**
 * `serverless-offline` sets `IS_OFFLINE=true` on every emulated Lambda (see
 * node_modules/serverless-offline/src/lambda/LambdaFunction.js) and injects the
 * provider environment, so a loopback endpoint is expected locally. A deployed
 * Lambda has no `IS_OFFLINE`, and must never push to loopback: `backend/.env`
 * sets http://localhost:3001 for offline, so a local `npm run deploy` would
 * otherwise bake that value into the stage and turn working real-time push into
 * silent failures (instead of the documented polling fallback).
 */
const IS_OFFLINE = process.env.IS_OFFLINE === 'true';

/** Builds a management-API client, or null when no usable endpoint is configured. */
function getClient(): ApiGatewayManagementApiClient | null {
  if (!WS_ENDPOINT) return null;
  if (!IS_OFFLINE && LOOPBACK_ENDPOINT.test(WS_ENDPOINT)) return null;
  return new ApiGatewayManagementApiClient({
    region: REGION,
    endpoint: WS_ENDPOINT,
  });
}

/**
 * Push a JSON payload to every live WebSocket connection belonging to an admin.
 *
 * Safe no-op when the admin has no connections, or when no `WEBSOCKET_ENDPOINT`
 * is configured (e.g. local `serverless offline`). Connections that have
 * dropped (GoneException) are cleaned up best-effort.
 */
export async function broadcastToAdmin(
  adminId: string,
  payload: unknown
): Promise<void> {
  // Resolve the client FIRST. Without a usable endpoint the push is a no-op, so
  // the connection lookup below would be a wasted database round trip.
  const client = getClient();
  if (!client) return;

  const connections = await AdminConnection.find({ adminId })
    .select('connectionId')
    .lean();
  if (connections.length === 0) return;

  const data = JSON.stringify(payload);
  const results = await Promise.allSettled(
    connections.map((conn) =>
      client.send(
        new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: data,
        })
      )
    )
  );

  // Best-effort cleanup of dropped connections.
  const toDelete: string[] = [];
  results.forEach((res, idx) => {
    if (
      res.status === 'rejected' &&
      (res.reason as { name?: string } | undefined)?.name === 'GoneException'
    ) {
      toDelete.push(connections[idx].connectionId);
    }
  });
  if (toDelete.length) {
    await AdminConnection.deleteMany({ connectionId: { $in: toDelete } });
  }
}

/**
 * Push one payload to several admins at once.
 *
 * Fan-out helper for SHARED state (e.g. a chat session that any staff member
 * just answered), where every recipient must learn the same thing. Notification
 * rows fan out per admin instead, because each recipient gets its own row.
 *
 * Takes resolved ids rather than a role filter so this module stays free of
 * `authorization.ts` — which imports `notifications.ts`, which imports this file.
 * Callers resolve the audience with `activeAdminIdsByRole()`.
 */
export async function broadcastToAdmins(
  adminIds: string[],
  payload: unknown
): Promise<void> {
  // Parallel on purpose: unlike sequential notification ids there is nothing to
  // race here, and each `broadcastToAdmin` is already a safe no-op on its own.
  await Promise.all(
    adminIds.map((adminId) => broadcastToAdmin(adminId, payload))
  );
}

/**
 * Push a JSON payload to every live WebSocket connection belonging to a
 * resident.
 *
 * Safe no-op when the resident has no connections, or when no
 * `WEBSOCKET_ENDPOINT` is configured (e.g. local `serverless offline`).
 * Connections that have dropped (GoneException) are cleaned up best-effort.
 */
export async function broadcastToResident(
  residentId: string,
  payload: unknown
): Promise<void> {
  // Resolve the client FIRST. Without a usable endpoint the push is a no-op, so
  // the connection lookup below would be a wasted database round trip.
  const client = getClient();
  if (!client) return;

  const connections = await ResidentConnection.find({ residentId })
    .select('connectionId')
    .lean();
  if (connections.length === 0) return;

  const data = JSON.stringify(payload);
  const results = await Promise.allSettled(
    connections.map((conn) =>
      client.send(
        new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: data,
        })
      )
    )
  );

  // Best-effort cleanup of dropped connections.
  const toDelete: string[] = [];
  results.forEach((res, idx) => {
    if (
      res.status === 'rejected' &&
      (res.reason as { name?: string } | undefined)?.name === 'GoneException'
    ) {
      toDelete.push(connections[idx].connectionId);
    }
  });
  if (toDelete.length) {
    await ResidentConnection.deleteMany({ connectionId: { $in: toDelete } });
  }
}
