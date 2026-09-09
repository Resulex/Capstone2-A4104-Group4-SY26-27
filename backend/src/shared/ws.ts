import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { AdminConnection, ResidentConnection } from '../models';

const REGION = process.env.AWS_REGION ?? 'ap-southeast-1';
const WS_ENDPOINT = process.env.WEBSOCKET_ENDPOINT ?? '';

/** Builds a management-API client, or null when no endpoint is configured. */
function getClient(): ApiGatewayManagementApiClient | null {
  if (!WS_ENDPOINT) return null;
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
  const connections = await AdminConnection.find({ adminId })
    .select('connectionId')
    .lean();
  const client = getClient();
  if (!client || connections.length === 0) return;

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
  const connections = await ResidentConnection.find({ residentId })
    .select('connectionId')
    .lean();
  const client = getClient();
  if (!client || connections.length === 0) return;

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
