import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { badRequestError } from '../../../shared/errors';
import { Notification, Admin } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

interface ReadByReferenceBody {
  referenceUrlIds?: string[];
  isRead?: boolean;
}

/**
 * Notifications — Read By Reference
 * Use-case: set the read state of every notification pointing at a set of records
 * (`referenceUrlId` — an `INC-…`, `REQ-…` or `chat-…` id) in one round trip, so an
 * admin queue row can be marked seen — or unread again — without one PATCH per
 * notification. Scoped to the caller's own notifications, like `read-all`.
 * PATCH /notifications/read-by-reference (authenticated)
 */
export async function markNotificationsByReference(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const body = parseBody(event) as ReadByReferenceBody;

  const referenceUrlIds = (body.referenceUrlIds ?? []).filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
  if (referenceUrlIds.length === 0) {
    throw badRequestError('referenceUrlIds must be a non-empty array of ids.');
  }

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

  const isRead = body.isRead ?? true;
  const result = await Notification.updateMany(
    { recipientId, referenceUrlId: { $in: referenceUrlIds }, isRead: !isRead },
    { $set: { isRead } }
  );

  return ok(
    { updated: result.modifiedCount },
    isRead ? 'Notifications marked read.' : 'Notifications marked unread.'
  );
}

export const handler = withErrorHandling(markNotificationsByReference);
