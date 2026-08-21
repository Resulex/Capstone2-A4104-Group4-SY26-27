import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Announcement } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Announcements — List
 * Use-case: list announcements. Any authenticated user may read public
 * announcements; hidden ones are only visible to staff/admin.
 * GET /announcements (authenticated)
 */
export async function listAnnouncements(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (auth.role === 'resident') {
    query.isHidden = false;
  }

  const announcements = await Announcement.find(query).sort({ createdAt: -1 }).lean();
  return ok(announcements, 'Announcements fetched.');
}

export const handler = withErrorHandling(listAnnouncements);