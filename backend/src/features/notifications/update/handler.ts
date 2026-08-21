import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Notification } from '../../../models';
import { getAuthContext, notificationScopeFilter } from '../../../shared/authorization';

interface UpdateNotificationBody {
  isRead?: boolean;
}

/**
 * Notifications — Update
 * Use-case: update a notification (e.g. mark as read). Residents update only
 * their own; admins may update any.
 * PATCH /notifications/{id} (authenticated)
 */
export async function updateNotification(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const notification = await Notification.findOne({
    $or: [{ _id: id }, { notificationId: id }],
  });
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

  const body = parseBody(event) as UpdateNotificationBody;
  if (body.isRead !== undefined) notification.isRead = body.isRead;

  await notification.save();
  return ok(notification.toObject(), 'Notification updated.');
}

export const handler = withErrorHandling(updateNotification);