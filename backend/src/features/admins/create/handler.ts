import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError } from '../../../shared/errors';
import { hashPassword } from '../../../shared/password';
import { Admin } from '../../../models';
import { resolveAuthContext, requireAssignedRole } from '../../../shared/authorization';

interface CreateAdminBody {
  adminId?: string;
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
 * Admins — Create
 * Use-case: create an admin account. Only users with the top-tier 'Admin'
 * assigned role may create administrators.
 * POST /admins (admin, assignedRole = Admin)
 */
export async function createAdmin(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireAssignedRole(auth, ['Admin']);

  const body = parseBody(event) as CreateAdminBody;
  const { adminId, firstName, lastName, userName, emailAddress, password } = body;

  if (!adminId || !firstName || !lastName || !userName || !emailAddress || !password) {
    return badRequest(
      'adminId, firstName, lastName, userName, emailAddress, and password are required.'
    );
  }

  await connectToDatabase();

  const existing = await Admin.findOne({
    $or: [{ adminId }, { userName }, { emailAddress: emailAddress.toLowerCase() }],
  });
  if (existing) {
    throw conflictError('An admin with this adminId, userName, or email already exists.');
  }

  const passwordHash = await hashPassword(password);

  const admin = await Admin.create({
    adminId,
    firstName,
    lastName,
    middleName: body.middleName || undefined,
    userName,
    emailAddress: emailAddress.toLowerCase(),
    passwordHash,
    assignedRole: body.assignedRole || 'Moderator',
    accountStatus: body.accountStatus || 'active',
  });

  return created(admin.toPublicJSON(), 'Admin created.');
}

export const handler = withErrorHandling(createAdmin);