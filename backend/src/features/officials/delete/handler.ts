import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Official } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

/**
 * Officials — Delete
 * Use-case: soft-delete an official record (archived for history).
 * Staff/admin only.
 * DELETE /officials/{id} (staff or admin)
 */
export async function deleteOfficial(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const official = await Official.findOne({
    $or: [{ _id: id }, { officialId: id }],
    isDeleted: false,
  });
  if (!official) {
    throw notFoundError('Official not found.');
  }

  // Soft-delete: archive the record rather than removing it.
  official.isDeleted = true;
  await official.save();

  return ok({ deleted: official.officialId }, 'Official archived.');
}

export const handler = withErrorHandling(deleteOfficial);