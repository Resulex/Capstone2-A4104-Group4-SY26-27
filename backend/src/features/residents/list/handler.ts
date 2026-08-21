import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Resident, User } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

/**
 * Residents — List
 * Use-case: list residents. Admins see all; officials see their barangay's
 * residents. Residents are not allowed to list residents.
 * GET /residents (staff or admin)
 */
export async function listResidents(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (auth.role === 'official') {
    // Scope to the official's own barangay via their User record.
    const user = await User.findById(auth.userId);
    if (!user) {
      throw new Error('Staff account not found.');
    }
    query.barangay = user.barangay;
  }

  const residents = await Resident.find(query).lean();
  const publicList = residents.map((r) => {
    const { passwordHash, ...rest } = r as unknown as Record<string, unknown>;
    return rest;
  });

  return ok(publicList, 'Residents fetched.');
}

export const handler = withErrorHandling(listResidents);