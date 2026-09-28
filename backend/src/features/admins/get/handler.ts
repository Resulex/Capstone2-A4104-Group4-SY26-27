import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Admin } from '../../../models';
import { resolveAuthContext, requireSuperAdmin } from '../../../shared/authorization';

/**
 * Admins — Get
 * Use-case: fetch a single administrator. SUPER_ADMIN only — this powers the
 * User Management detail page, which only super admins may open.
 * GET /admins/{id} (admin, assignedRole = SUPER_ADMIN)
 */
export async function getAdmin(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const admin = await Admin.findOne(buildIdOrCustomIdQuery(id, 'adminId'));

  if (!admin) {
    throw notFoundError('Admin not found.');
  }

  return ok(admin.toPublicJSON(), 'Admin fetched.');
}

export const handler = withErrorHandling(getAdmin);