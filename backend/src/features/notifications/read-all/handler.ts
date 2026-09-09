import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Notification, Admin } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Notifications — Read All
 * Use-case: mark all of the caller's notifications as read (per-admin badge).
 * PATCH /notifications/read-all (authenticated)
 */
export async function markAllNotificationsRead(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  await connectToDatabase();

  let recipientId: unknown = auth.userId;
  if (auth.role === 'admin') {
    const admin = await Admin.findOne({ adminId: auth.userId })
      .select('_id')
      .lean();
    recipientId = admin ? admin._id : auth.userId;
  }

  const result = await Notification.updateMany(
    { recipientId, isRead: false },
    { $set: { isRead: true } }
  );

  return ok({ updated: result.modifiedCount }, 'All notifications marked read.');
}

export const handler = withErrorHandling(markAllNotificationsRead);
