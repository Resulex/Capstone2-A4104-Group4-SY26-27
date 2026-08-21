import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Barangay } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

interface UpdateBarangayBody {
  name?: string;
  city?: string;
  province?: string;
  region?: string;
  zipCode?: string;
  isActive?: boolean;
}

/**
 * Barangays — Update
 * Use-case: update a barangay record. Staff/admin only.
 * PATCH /barangays/{id} (staff or admin)
 */
export async function updateBarangay(
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

  const body = parseBody(event) as UpdateBarangayBody;
  if (body.name !== undefined) barangay.name = body.name;
  if (body.city !== undefined) barangay.city = body.city;
  if (body.province !== undefined) barangay.province = body.province;
  if (body.region !== undefined) barangay.region = body.region;
  if (body.zipCode !== undefined) barangay.zipCode = body.zipCode;
  if (body.isActive !== undefined) barangay.isActive = body.isActive;

  await barangay.save();
  return ok(barangay.toObject(), 'Barangay updated.');
}

export const handler = withErrorHandling(updateBarangay);