import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Notification, Admin } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Notifications — Mine
 * Use-case: list only the caller's own notifications, newest first. Used by the
 * admin notification badge/popup and the resident notification center.
 * GET /notifications/mine (authenticated)
 */
export async function listMyNotifications(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  await connectToDatabase();

  // Admins store notifications by their Admin._id; the JWT sub is the adminId
  // string, so resolve the canonical _id. Residents use their own _id directly.
  let recipientId: unknown = auth.userId;
  if (auth.role === 'admin') {
    const admin = await Admin.findOne({ adminId: auth.userId })
      .select('_id')
      .lean();
    recipientId = admin ? admin._id : auth.userId;
  }

  const notifications = await Notification.find({ recipientId })
    .sort({ createdAt: -1 })
    .lean();
  return ok(notifications, 'Notifications fetched.');
}

export const handler = withErrorHandling(listMyNotifications);
