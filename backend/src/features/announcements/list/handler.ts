import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Announcement } from '../../../models';
import { resolveAuthContext } from '../../../shared/authorization';
import { archiveScopeFilter } from '../../../shared/archive';

/**
 * Announcements — List
 * Use-case: list announcements. Any authenticated user may read public
 * announcements; hidden ones are only visible to staff/admin. Archived content
 * is excluded for everyone unless a SUPER_ADMIN asks for `?scope=archived`.
 * GET /announcements?scope=active|archived (authenticated)
 */
export async function listAnnouncements(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  // `resolveAuthContext` (not `getAuthContext`): the archived scope needs the
  // admin's `assignedRole`, which only the loaded Admin document carries.
  const auth = await resolveAuthContext(event);
  await connectToDatabase();

  // Archived announcements are RETIRED content: they leave the public feed and
  // the admin list alike, and only a SUPER_ADMIN can read them back.
  const query: Record<string, unknown> = archiveScopeFilter(event, auth);

  // `isHidden` remains a separate axis — hidden means "unpublished draft", which
  // only staff/admin may see.
  if (auth.role === 'resident') {
    query.isHidden = false;
  }

  const announcements = await Announcement.find(query).sort({ createdAt: -1 }).lean();
  return ok(announcements, 'Announcements fetched.');
}

export const handler = withErrorHandling(listAnnouncements);