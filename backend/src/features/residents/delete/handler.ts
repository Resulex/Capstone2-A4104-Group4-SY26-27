import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Resident } from '../../../models';
import { getAuthContext, assertResidentOwnership } from '../../../shared/authorization';

/**
 * Residents — Delete
 * Use-case: delete a resident. Residents may only delete their own record.
 * DELETE /residents/{id} (authenticated)
 */
export async function deleteResident(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const resident = await Resident.findOne({
    $or: [{ _id: id }, { residentId: id }],
  });
  if (!resident) {
    throw notFoundError('Resident not found.');
  }

  // Residents may only delete their own record.
  if (auth.role === 'resident') {
    assertResidentOwnership(auth, resident.residentId);
  }

  await resident.deleteOne();
  return ok({ deleted: resident.residentId }, 'Resident deleted.');
}

export const handler = withErrorHandling(deleteResident);