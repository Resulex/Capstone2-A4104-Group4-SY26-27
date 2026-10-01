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
import { Official } from '../../../models';
import { requireSuperAdmin, resolveAuthContext } from '../../../shared/authorization';

/**
 * Officials — Archive / Restore
 *
 * Use-case: retire a barangay official from the public directory while keeping
 * the record for history, and — new — bring them back.
 *
 * Like residents, the flag is the pre-existing `Official.isDeleted` rather than a
 * second `isArchived`. `deletedAt`/`archivedBy`/`archivedReason` were added to the
 * schema so an archive is attributable; the old path (a bare `isDeleted: true`
 * through the generic PATCH) recorded neither a date nor an actor.
 *
 * This is the ONE place an official may be archived, and it is SUPER_ADMIN only.
 * Previously the generic update route allowed an official or operations clerk to
 * retire a directory entry.
 *
 * POST /officials/{id}/archive   (super admin)
 * POST /officials/{id}/restore   (super admin)
 */

async function archive(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const official = await Official.findOne(buildIdOrCustomIdQuery(id, 'officialId'));
  if (!official) {
    throw notFoundError('Official not found.');
  }

  if (!official.isDeleted) {
    const body = parseOptionalBody(event);
    const reason =
      typeof body.reason === 'string' ? body.reason.trim() || undefined : undefined;

    official.isDeleted = true;
    official.deletedAt = new Date();
    official.archivedBy = auth.admin?.adminId;
    official.archivedReason = reason;

    await official.save();
  }

  return ok(official.toObject(), 'Official archived.');
}

async function restore(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const official = await Official.findOne(buildIdOrCustomIdQuery(id, 'officialId'));
  if (!official) {
    throw notFoundError('Official not found.');
  }

  if (official.isDeleted) {
    official.isDeleted = false;
    official.deletedAt = undefined;
    official.archivedBy = undefined;
    official.archivedReason = undefined;

    await official.save();
  }

  return ok(official.toObject(), 'Official restored.');
}

// Both routes point at the WRAPPED exports. Registering the raw functions in
// `serverless.yml` would let a thrown AppError escape `withErrorHandling`, so a
// non-super admin's 403 would surface as an opaque 502 instead.
export const archiveHandler = withErrorHandling(archive);
export const restoreHandler = withErrorHandling(restore);
