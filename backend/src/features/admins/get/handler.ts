import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Admin } from '../../../models';
import { getAuthContext, requireAdmin } from '../../../shared/authorization';

/**
 * Admins — Get
 * Use-case: fetch a single administrator. Admin role only.
 * GET /admins/{id} (admin)
 */
export async function getAdmin(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const admin = await Admin.findOne(
    buildIdOrCustomIdQuery(id, 'adminId')
  ).select('+passwordHash');

  if (!admin) {
    throw notFoundError('Admin not found.');
  }

  return ok(admin.toPublicJSON(), 'Admin fetched.');
}

export const handler = withErrorHandling(getAdmin);