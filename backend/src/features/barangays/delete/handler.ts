import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Barangay } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

/**
 * Barangays — Delete
 * Use-case: delete a barangay record. Staff/admin only.
 * DELETE /barangays/{id} (staff or admin)
 */
export async function deleteBarangay(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const barangay = await Barangay.findById(id);
  if (!barangay) {
    throw notFoundError('Barangay not found.');
  }

  await barangay.deleteOne();
  return ok({ deleted: String(barangay._id) }, 'Barangay deleted.');
}

export const handler = withErrorHandling(deleteBarangay);