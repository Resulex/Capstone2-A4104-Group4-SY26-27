import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Notification } from '../../../models';
import { getAuthContext, notificationScopeFilter } from '../../../shared/authorization';

/**
 * Notifications — Delete
 * Use-case: delete a notification. Residents delete only their own; admins
 * may delete any.
 * DELETE /notifications/{id} (authenticated)
 */
export async function deleteNotification(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const notification = await Notification.findOne(buildIdOrCustomIdQuery(id, 'notificationId'));
  if (!notification) {
    throw notFoundError('Notification not found.');
  }

  // Enforce ownership for non-admins.
  if (auth.role !== 'admin') {
    const scope = notificationScopeFilter(auth);
    const matches = Object.entries(scope).every(
      ([k, v]) => String(notification.get(k)) === String(v)
    );
    if (!matches) {
      throw notFoundError('Notification not found.');
    }
  }

  await notification.deleteOne();
  return ok({ deleted: notification.notificationId }, 'Notification deleted.');
}

export const handler = withErrorHandling(deleteNotification);