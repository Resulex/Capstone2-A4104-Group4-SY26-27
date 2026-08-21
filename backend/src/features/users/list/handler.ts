import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { User } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

/**
 * Users — List
 * Use-case: list users. Staff see their barangay's users; admins see all.
 * Residents are not allowed to list users.
 * GET /users (staff or admin)
 */
export async function listUsers(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (auth.role === 'official') {
    const user = await User.findById(auth.userId);
    if (!user) {
      throw new Error('Staff account not found.');
    }
    query.barangay = user.barangay;
  }

  const users = await User.find(query).lean();
  const publicList = users.map((u) => {
    const { passwordHash, ...rest } = u as unknown as Record<string, unknown>;
    return rest;
  });

  return ok(publicList, 'Users fetched.');
}

export const handler = withErrorHandling(listUsers);