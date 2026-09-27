import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Notification, Admin } from '../../../models';
import { getAuthContext, residentDeletionCutoff } from '../../../shared/authorization';

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

  const filter: Record<string, unknown> = { recipientId };

  // A resident whose account was deleted stops seeing the notifications that
  // pointed at their pre-deletion records — otherwise the bell and badge would
  // keep advertising records the portal no longer shows. Derived from the same
  // cutoff as the records themselves, so restoring brings them all back.
  const cutoff = await residentDeletionCutoff(auth);
  if (cutoff) {
    filter.$or = [{ createdAt: { $gt: cutoff } }, { createdAt: null }];
  }
  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .lean();
  return ok(notifications, 'Notifications fetched.');
}

export const handler = withErrorHandling(listMyNotifications);
