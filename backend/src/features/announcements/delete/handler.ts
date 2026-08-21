import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Announcement } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

/**
 * Announcements — Delete
 * Use-case: delete an announcement. Staff/admin only.
 * DELETE /announcements/{id} (staff or admin)
 */
export async function deleteAnnouncement(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const announcement = await Announcement.findOne({
    $or: [{ _id: id }, { announcementId: id }],
  });
  if (!announcement) {
    throw notFoundError('Announcement not found.');
  }

  await announcement.deleteOne();
  return ok({ deleted: announcement.announcementId }, 'Announcement deleted.');
}

export const handler = withErrorHandling(deleteAnnouncement);