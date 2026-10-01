import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Official } from '../../../models';
import { resolveAuthContext } from '../../../shared/authorization';
import { archiveScopeFilter } from '../../../shared/archive';

/**
 * Officials — List
 * Use-case: list officials (directory). Any authenticated user may read.
 * Archived (soft-deleted) officials are excluded unless a SUPER_ADMIN asks for
 * `?scope=archived`.
 * GET /officials?scope=active|archived (authenticated)
 */
export async function listOfficials(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  // `resolveAuthContext` (not `getAuthContext`): the archived scope needs the
  // admin's `assignedRole`, which only the loaded Admin document carries.
  const auth = await resolveAuthContext(event);
  await connectToDatabase();

  // Officials predate the archive flag, so their soft-delete column is
  // `isDeleted`. This also replaces the old strict `isDeleted: false` match with
  // "not equal to true", which keeps records that predate the field visible.
  const officials = await Official.find(archiveScopeFilter(event, auth, 'isDeleted')).lean();
  return ok(officials, 'Officials fetched.');
}

export const handler = withErrorHandling(listOfficials);