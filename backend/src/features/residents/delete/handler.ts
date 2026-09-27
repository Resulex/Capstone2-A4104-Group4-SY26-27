import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Resident } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

/**
 * Residents — Delete (soft)
 * Use-case: soft-delete a resident so it disappears from the Residents list
 * while the record is retained for history. Staff/admin only.
 * DELETE /residents/{id} (staff or admin)
 */
export async function deleteResident(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const resident = await Resident.findOne(buildIdOrCustomIdQuery(id, 'residentId'));
  if (!resident) {
    throw notFoundError('Resident not found.');
  }

  // Soft-delete: archive the record rather than removing it.
  resident.isDeleted = true;
  resident.deletedAt = new Date();
  await resident.save();

  return ok(
    { deleted: resident.residentId ?? String(resident._id) },
    'Resident archived.'
  );
}

export const handler = withErrorHandling(deleteResident);