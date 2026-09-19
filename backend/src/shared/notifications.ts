import { Notification, Resident, Admin } from '../models';
import { connectToDatabase } from '../config/db';
import { broadcastToAdmin, broadcastToResident } from './ws';
// Type-only: `authorization.ts` imports `residentFullName` from this module, so a
// value import here would close a runtime cycle. Types are erased.
import type { AdminAssignedRole } from './authorization';

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

/**
 * The `_id`s (as strings) of every active admin, optionally narrowed to a set
 * of `assignedRole`s.
 *
 * Exists so a caller can resolve "the staff who should hear about this" ONCE and
 * use the same list for both the notification rows and a WebSocket push, instead
 * of paying for two Admin lookups.
 */
export async function activeAdminIdsByRole(
  roles?: AdminAssignedRole[]
): Promise<string[]> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { accountStatus: 'active' };
  if (roles && roles.length > 0) filter.assignedRole = { $in: roles };
  const admins = await Admin.find(filter).select('_id').lean();
  return admins.map((admin) => String(admin._id));
}

/**
 * Send the same notification to every active admin as independent records.
 *
 * Returns the Admin `_id`s actually notified (i.e. after `excludeAdminId`), so
 * the caller can push a matching real-time update to exactly that audience.
 */
export async function notifyAllActiveAdmins(
  input: Omit<NotificationInput, 'recipientId'>,
  options: { excludeAdminId?: string; roles?: AdminAssignedRole[] } = {}
): Promise<string[]> {
  // `excludeAdminId` is an Admin `_id`. It keeps the person who made a status
  // change out of their own feed — otherwise resolving a record would
  // immediately flag it as unread for the admin who just resolved it.
  const recipientIds = (await activeAdminIdsByRole(options.roles)).filter(
    (adminId) => adminId !== options.excludeAdminId
  );
  // Sequential to avoid race conditions on sequential notification ids.
  for (const recipientId of recipientIds) {
    await sendAdminNotification({ ...input, recipientId });
  }
  return recipientIds;
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
