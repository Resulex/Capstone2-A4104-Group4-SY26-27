import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError } from '../../../shared/errors';
import { Barangay } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

interface CreateBarangayBody {
  name?: string;
  city?: string;
  province?: string;
  region?: string;
  zipCode?: string;
  isActive?: boolean;
}

/**
 * Barangays — Create
 * Use-case: create a barangay record. Staff/admin only.
 * POST /barangays (staff or admin)
 */
export async function createBarangay(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  const body = parseBody(event) as CreateBarangayBody;
  const { name, city, province, region } = body;

  if (!name || !city || !province || !region) {
    return badRequest('name, city, province, and region are required.');
  }

  await connectToDatabase();

  const existing = await Barangay.findOne({ name, city, province });
  if (existing) {
    throw conflictError('A barangay with these details already exists.');
  }

  const barangay = await Barangay.create({
    name,
    city,
    province,
    region,
    zipCode: body.zipCode || undefined,
    isActive: body.isActive ?? true,
  });

  return created(barangay.toObject(), 'Barangay created.');
}

export const handler = withErrorHandling(createBarangay);