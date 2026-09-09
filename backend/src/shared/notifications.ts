import { Notification, Resident, Admin } from '../models';
import { connectToDatabase } from '../config/db';
import { broadcastToAdmin, broadcastToResident } from './ws';

export type NotifyCategory =
  | 'incidentAlert'
  | 'documentUpdate'
  | 'systemMessage'
  | 'chatMessage';

export interface NotificationInput {
  recipientId: string;
  category: NotifyCategory;
  titleText: string;
  messageBody: string;
  referenceUrlId?: string;
}

/** Builds the next sequential notification id (NOT-<year><5-digit seq>). */
export async function nextNotificationId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NOT-${year}`;
  const last = await Notification.findOne({
    notificationId: { $regex: `^${prefix}\\d{5}$` },
  })
    .sort({ notificationId: -1 })
    .select('notificationId')
    .lean();
  const seq = last
    ? parseInt(last.notificationId.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

/**
 * Persist a notification for a single admin and push it over the admin's live
 * WebSocket connections.
 */
export async function sendAdminNotification(
  input: NotificationInput
): Promise<void> {
  const notificationId = await nextNotificationId();
  const notification = await Notification.create({
    notificationId,
    recipientId: input.recipientId,
    notificationCategory: input.category,
    titleText: input.titleText,
    messageBody: input.messageBody,
    referenceUrlId: input.referenceUrlId || undefined,
    isRead: false,
  });
  await broadcastToAdmin(String(input.recipientId), {
    type: 'notification',
    notification: notification.toObject(),
  });
}

/**
 * Persist a notification for a single resident and push it over the
 * resident's live WebSocket connections.
 */
export async function sendResidentNotification(
  input: NotificationInput
): Promise<void> {
  const notificationId = await nextNotificationId();
  const notification = await Notification.create({
    notificationId,
    recipientId: input.recipientId,
    notificationCategory: input.category,
    titleText: input.titleText,
    messageBody: input.messageBody,
    referenceUrlId: input.referenceUrlId || undefined,
    isRead: false,
  });
  await broadcastToResident(String(input.recipientId), {
    type: 'notification',
    notification: notification.toObject(),
  });
}

/** Send the same notification to every active admin as independent records. */
export async function notifyAllActiveAdmins(
  input: Omit<NotificationInput, 'recipientId'>
): Promise<void> {
  await connectToDatabase();
  const admins = await Admin.find({ accountStatus: 'active' })
    .select('_id')
    .lean();
  // Sequential to avoid race conditions on sequential notification ids.
  for (const admin of admins) {
    await sendAdminNotification({ ...input, recipientId: String(admin._id) });
  }
}

/** Resolve a resident's full name from an id (_id or residentId). */
export async function residentFullName(residentId: string): Promise<string> {
  await connectToDatabase();
  const resident = await Resident.findOne({
    $or: [{ _id: residentId }, { residentId }],
  })
    .select('firstName middleName lastName suffix')
    .lean();
  if (!resident) return 'Resident';
  return (
    [resident.firstName, resident.middleName, resident.lastName, resident.suffix]
      .filter(Boolean)
      .join(' ') || 'Resident'
  );
}
