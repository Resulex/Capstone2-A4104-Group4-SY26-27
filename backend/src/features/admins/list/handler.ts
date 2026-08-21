import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Admin } from '../../../models';
import { getAuthContext, requireAdmin } from '../../../shared/authorization';

/**
 * Admins — List
 * Use-case: list administrators. Restricted to the admin role.
 * GET /admins (admin)
 */
export async function listAdmins(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireAdmin(auth);

  await connectToDatabase();

  const admins = await Admin.find().lean();
  const publicList = admins.map((a) => {
    const { passwordHash, ...rest } = a as unknown as Record<string, unknown>;
    return rest;
  });

  return ok(publicList, 'Admins fetched.');
}

export const handler = withErrorHandling(listAdmins);