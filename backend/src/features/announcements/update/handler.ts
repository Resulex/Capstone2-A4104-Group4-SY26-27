import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Announcement } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

interface UpdateAnnouncementBody {
  titleText?: string;
  descriptionContent?: string;
  priorityLevel?: 'high' | 'medium' | 'low';
  imageUrl?: string;
  eventDate?: string;
  isHidden?: boolean;
}

/**
 * Announcements — Update
 * Use-case: update an announcement. Staff/admin only.
 * PATCH /announcements/{id} (staff or admin)
 */
export async function updateAnnouncement(
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

  const body = parseBody(event) as UpdateAnnouncementBody;

  if (body.titleText !== undefined) announcement.titleText = body.titleText;
  if (body.descriptionContent !== undefined) announcement.descriptionContent = body.descriptionContent;
  if (body.priorityLevel !== undefined) announcement.priorityLevel = body.priorityLevel;
  if (body.imageUrl !== undefined) announcement.imageUrl = body.imageUrl;
  if (body.eventDate !== undefined) announcement.eventDate = new Date(body.eventDate);
  if (body.isHidden !== undefined) announcement.isHidden = body.isHidden;

  await announcement.save();
  return ok(announcement.toObject(), 'Announcement updated.');
}

export const handler = withErrorHandling(updateAnnouncement);