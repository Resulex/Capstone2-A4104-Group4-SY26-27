import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError, badRequestError } from '../../../shared/errors';
import { Notification, Resident, Admin } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

interface CreateNotificationBody {
  notificationId?: string;
  recipientId?: string;
  notificationCategory?: 'incidentAlert' | 'documentUpdate' | 'systemMessage';
  titleText?: string;
  messageBody?: string;
  referenceUrlId?: string;
  isRead?: boolean;
}

/**
 * Notifications — Create
 * Use-case: create/send a notification. Staff/admin only. Recipients may be
 * residents or admins.
 * POST /notifications (staff or admin)
 */
export async function createNotification(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  const body = parseBody(event) as CreateNotificationBody;
  const { notificationId, recipientId, notificationCategory, titleText, messageBody } = body;

  if (!notificationId || !recipientId || !notificationCategory || !titleText || !messageBody) {
    return badRequest(
      'notificationId, recipientId, notificationCategory, titleText, and messageBody are required.'
    );
  }

  await connectToDatabase();

  const existing = await Notification.findOne({ notificationId });
  if (existing) {
    throw conflictError('A notification with this notificationId already exists.');
  }

  // Validate recipient exists as a resident or admin.
  const resident = await Resident.findOne({
    $or: [{ _id: recipientId }, { residentId: recipientId }],
  });
  const admin = await Admin.findOne({
    $or: [{ _id: recipientId }, { adminId: recipientId }],
  });
  if (!resident && !admin) {
    throw badRequestError('Invalid recipientId.');
  }

  const notification = await Notification.create({
    notificationId,
    recipientId,
    notificationCategory,
    titleText,
    messageBody,
    referenceUrlId: body.referenceUrlId || undefined,
    isRead: body.isRead ?? false,
  });

  return created(notification.toObject(), 'Notification created.');
}

export const handler = withErrorHandling(createNotification);