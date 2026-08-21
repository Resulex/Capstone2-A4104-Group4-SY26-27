import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError, notFoundError } from '../../../shared/errors';
import { Announcement, Admin } from '../../../models';
import { resolveAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

interface CreateAnnouncementBody {
  announcementId?: string;
  titleText?: string;
  descriptionContent?: string;
  priorityLevel?: 'high' | 'medium' | 'low';
  imageUrl?: string;
  eventDate?: string;
  isHidden?: boolean;
}

/**
 * Announcements — Create
 * Use-case: create an announcement. Staff/admin only.
 * POST /announcements (staff or admin)
 */
export async function createAnnouncement(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireStaffOrAdmin(auth);

  const body = parseBody(event) as CreateAnnouncementBody;
  const { announcementId, titleText, descriptionContent } = body;

  if (!announcementId || !titleText || !descriptionContent) {
    return badRequest('announcementId, titleText, and descriptionContent are required.');
  }

  await connectToDatabase();

  const existing = await Announcement.findOne({ announcementId });
  if (existing) {
    throw conflictError('An announcement with this announcementId already exists.');
  }

  // Resolve the author Admin by the caller's adminId.
  let authorId: string;
  if (auth.role === 'admin' && auth.admin) {
    const admin = await Admin.findOne({ adminId: auth.admin.adminId });
    if (!admin) throw notFoundError('Admin author not found.');
    authorId = String(admin._id);
  } else {
    // Officials use their User record; store the user id as author reference.
    authorId = auth.userId;
  }

  const announcement = await Announcement.create({
    announcementId,
    titleText,
    descriptionContent,
    priorityLevel: body.priorityLevel || 'low',
    authorId,
    imageUrl: body.imageUrl || undefined,
    eventDate: body.eventDate ? new Date(body.eventDate) : undefined,
    isHidden: body.isHidden ?? false,
  });

  return created(announcement.toObject(), 'Announcement created.');
}

export const handler = withErrorHandling(createAnnouncement);