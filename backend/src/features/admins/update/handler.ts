import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { hashPassword } from '../../../shared/password';
import { Admin } from '../../../models';
import { resolveAuthContext, requireAssignedRole } from '../../../shared/authorization';

interface UpdateAdminBody {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  userName?: string;
  emailAddress?: string;
  password?: string;
  assignedRole?: 'Admin' | 'Moderator' | 'Content Admin';
  accountStatus?: 'active' | 'suspended' | 'deactivated';
}

/**
 * Admins — Update
 * Use-case: update an admin account. Role/status changes require the top-tier
 * 'Admin' assigned role; basic profile edits allow any admin.
 * PATCH /admins/{id} (admin)
 */
export async function updateAdmin(
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

  const body = parseBody(event) as UpdateAdminBody;

  // Top-tier guard for role/status changes and attribute edits that affect
  // other admins. A top-tier Admin can update anyone.
  const changesRoleOrStatus =
    body.assignedRole !== undefined ||
    body.accountStatus !== undefined ||
    body.userName !== undefined ||
    body.emailAddress !== undefined;
  if (changesRoleOrStatus) {
    requireAssignedRole(auth, ['Admin']);
  }

  if (body.firstName !== undefined) admin.firstName = body.firstName;
  if (body.lastName !== undefined) admin.lastName = body.lastName;
  if (body.middleName !== undefined) admin.middleName = body.middleName;
  if (body.userName !== undefined) admin.userName = body.userName;
  if (body.emailAddress !== undefined) admin.emailAddress = body.emailAddress.toLowerCase();
  if (body.assignedRole !== undefined) admin.assignedRole = body.assignedRole;
  if (body.accountStatus !== undefined) admin.accountStatus = body.accountStatus;
  if (body.password !== undefined) {
    admin.passwordHash = await hashPassword(body.password);
  }

  await admin.save();
  return ok(admin.toPublicJSON(), 'Admin updated.');
}

export const handler = withErrorHandling(updateAdmin);