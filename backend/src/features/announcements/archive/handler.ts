import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import {
  withErrorHandling,
  parseOptionalBody,
  parsePathParam,
  buildIdOrCustomIdQuery,
} from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Announcement } from '../../../models';
import { requireSuperAdmin, resolveAuthContext } from '../../../shared/authorization';

/**
 * Announcements — Archive / Restore
 *
 * Use-case: retire a published announcement without deleting it. This is the
 * only replacement for the hard `DELETE /announcements/{id}`, which destroyed the
 * content outright and made "retrieval of all announcements" impossible.
 *
 * Archived is NOT the same as `isHidden`: hidden means "unpublished draft",
 * archived means "retired". An archived announcement is excluded from the public
 * feed AND from the admin list, and only the Archived view resolves it.
 *
 * Announcements have no timeline, so the audit trail lives in the four archive
 * fields (who, when, why) rather than in an appended history entry.
 *
 * SUPER_ADMIN only.
 *
 * POST /announcements/{id}/archive   (super admin)
 * POST /announcements/{id}/restore   (super admin)
 */

async function archive(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const announcement = await Announcement.findOne(
    buildIdOrCustomIdQuery(id, 'announcementId')
  );
  if (!announcement) {
    throw notFoundError('Announcement not found.');
  }

  if (!announcement.isArchived) {
    const body = parseOptionalBody(event);
    const reason =
      typeof body.reason === 'string' ? body.reason.trim() || undefined : undefined;

    announcement.isArchived = true;
    announcement.archivedAt = new Date();
    announcement.archivedBy = auth.admin?.adminId;
    announcement.archivedReason = reason;

    await announcement.save();
  }

  return ok(announcement.toObject(), 'Announcement archived.');
}

async function restore(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const announcement = await Announcement.findOne(
    buildIdOrCustomIdQuery(id, 'announcementId')
  );
  if (!announcement) {
    throw notFoundError('Announcement not found.');
  }

  if (announcement.isArchived) {
    announcement.isArchived = false;
    announcement.archivedAt = undefined;
    announcement.archivedBy = undefined;
    announcement.archivedReason = undefined;

    await announcement.save();
  }

  return ok(announcement.toObject(), 'Announcement restored.');
}

// Both routes point at the WRAPPED exports. Registering the raw functions in
// `serverless.yml` would let a thrown AppError escape `withErrorHandling`, so a
// non-super admin's 403 would surface as an opaque 502 instead.
export const archiveHandler = withErrorHandling(archive);
export const restoreHandler = withErrorHandling(restore);
