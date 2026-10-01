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
import { Resident } from '../../../models';
import { requireSuperAdmin, resolveAuthContext } from '../../../shared/authorization';

/**
 * Residents — Archive / Restore (resident records)
 *
 * Use-case: retire a resident record from the Residents list while keeping it
 * for history, and — new — bring it back.
 *
 * The flag is the pre-existing `Resident.isDeleted`, NOT a second `isArchived`:
 * every guard in the residents feature already reads `isDeleted`, and a parallel
 * flag would let a record be "archived" yet still treated as active. `deletedAt`
 * is the matching timestamp; `archivedBy`/`archivedReason` add the who/why that
 * the old inline soft-delete never recorded.
 *
 * This is the ONE place a resident record may be archived. The `isDeleted` write
 * that used to live in `residents/update` has been removed, so an official can
 * no longer archive a resident through the generic PATCH route.
 *
 * SUPER_ADMIN only.
 *
 * POST /residents/{id}/archive   (super admin)
 * POST /residents/{id}/restore   (super admin)
 */

async function archive(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const resident = await Resident.findOne(buildIdOrCustomIdQuery(id, 'residentId'));
  if (!resident) {
    throw notFoundError('Resident not found.');
  }

  if (!resident.isDeleted) {
    const body = parseOptionalBody(event);
    const reason =
      typeof body.reason === 'string' ? body.reason.trim() || undefined : undefined;

    resident.isDeleted = true;
    resident.deletedAt = new Date();
    resident.archivedBy = auth.admin?.adminId;
    resident.archivedReason = reason;

    await resident.save();
  }

  return ok(resident.toPublicJSON(), 'Resident archived.');
}

async function restore(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const resident = await Resident.findOne(buildIdOrCustomIdQuery(id, 'residentId'));
  if (!resident) {
    throw notFoundError('Resident not found.');
  }

  if (resident.isDeleted) {
    resident.isDeleted = false;
    resident.deletedAt = undefined;
    resident.archivedBy = undefined;
    resident.archivedReason = undefined;

    await resident.save();
  }

  return ok(resident.toPublicJSON(), 'Resident restored.');
}

// Both routes point at the WRAPPED exports. Registering the raw functions in
// `serverless.yml` would let a thrown AppError escape `withErrorHandling`, so a
// non-super admin's 403 would surface as an opaque 502 instead.
export const archiveHandler = withErrorHandling(archive);
export const restoreHandler = withErrorHandling(restore);
