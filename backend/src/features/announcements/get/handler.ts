import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError, forbiddenError } from '../../../shared/errors';
import { Announcement } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Announcements — Get
 * Use-case: fetch a single announcement. Any authenticated user may read
 * public announcements; hidden ones require staff/admin.
 * GET /announcements/{id} (authenticated)
 */
export async function getAnnouncement(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const announcement = await Announcement.findOne({
    $or: [{ _id: id }, { announcementId: id }],
  });
  if (!announcement) {
    throw notFoundError('Announcement not found.');
  }

  if (announcement.isHidden && auth.role === 'resident') {
    throw forbiddenError('This announcement is not available.');
  }

  return ok(announcement.toObject(), 'Announcement fetched.');
}

export const handler = withErrorHandling(getAnnouncement);