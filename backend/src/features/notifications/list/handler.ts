import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Notification } from '../../../models';
import { getAuthContext, notificationScopeFilter } from '../../../shared/authorization';

/**
 * Notifications — List
 * Use-case: list notifications. Residents see only their own; admins see all
 * (e.g. incident alerts to admins). Officials see notifications addressed to
 * them.
 * GET /notifications (authenticated)
 */
export async function listNotifications(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (auth.role !== 'admin') {
    Object.assign(query, notificationScopeFilter(auth));
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .lean();
  return ok(notifications, 'Notifications fetched.');
}

export const handler = withErrorHandling(listNotifications);