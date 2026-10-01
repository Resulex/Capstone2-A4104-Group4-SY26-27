import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Admin } from '../../../models';
import { resolveAuthContext, requireSuperAdmin } from '../../../shared/authorization';

/**
 * Admins — Get
 * Use-case: fetch a single administrator.
 *
 * An admin may always read their OWN record: `frontend/src/app/api/admin/profile`
 * proxies this route with the session JWT's subject for the sidebar/settings
 * profile, and the admin console fails closed when that fetch fails — so gating
 * the whole route to SUPER_ADMIN locked every OPERATIONS_CLERK / INFO_OFFICER
 * out of the entire `/admin/*` console.
 *
 * Reading ANOTHER admin stays SUPER_ADMIN-only (the User Management detail
 * page is the only consumer of that case).
 * GET /admins/{id} (admin: own record; any record for assignedRole = SUPER_ADMIN)
 */
export async function getAdmin(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const admin = await Admin.findOne(buildIdOrCustomIdQuery(id, 'adminId'));

  if (!admin) {
    throw notFoundError('Admin not found.');
  }

  // Same self test as `admins/update`: the JWT subject is the Mongo `_id`,
  // while `auth.admin` was resolved through `adminId` (with an `_id` fallback).
  const targetIsSelf =
    auth.admin?.adminId === admin.adminId || String(admin._id) === auth.userId;
  if (!targetIsSelf) {
    requireSuperAdmin(auth);
  }

  return ok(admin.toPublicJSON(), 'Admin fetched.');
}

export const handler = withErrorHandling(getAdmin);