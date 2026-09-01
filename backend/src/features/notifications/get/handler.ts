import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Notification } from '../../../models';
import { getAuthContext, notificationScopeFilter } from '../../../shared/authorization';

/**
 * Notifications — Get
 * Use-case: fetch a single notification. Residents see only their own;
 * admins see any.
 * GET /notifications/{id} (authenticated)
 */
export async function getNotification(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const notification = await Notification.findOne(
    buildIdOrCustomIdQuery(id, 'notificationId')
  );
  if (!notification) {
    throw notFoundError('Notification not found.');
  }

  // Enforce ownership for non-admins via the scope filter.
  if (auth.role !== 'admin') {
    const scope = notificationScopeFilter(auth);
    const matches = Object.entries(scope).every(
      ([k, v]) => String(notification.get(k)) === String(v)
    );
    if (!matches) {
      throw notFoundError('Notification not found.');
    }
  }

  return ok(notification.toObject(), 'Notification fetched.');
}

export const handler = withErrorHandling(getNotification);