import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError } from '../../../shared/errors';
import { hashPassword } from '../../../shared/password';
import { Admin } from '../../../models';
import { resolveAuthContext, requireAssignedRole } from '../../../shared/authorization';
import { getCognitoGateway, cognitoReady } from '../../../shared/cognito';

interface CreateAdminBody {
  adminId?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  userName?: string;
  emailAddress?: string;
  password?: string;
  phoneNumber?: string;
  assignedRole?: 'SUPER_ADMIN' | 'OPERATIONS_CLERK' | 'INFO_OFFICER';
  accountStatus?: 'active' | 'suspended' | 'deactivated';
}

/**
 * Admins — Create
 * Use-case: create an admin account. Only users with the top-tier
 * 'SUPER_ADMIN' assigned role may create administrators.
 * POST /admins (admin, assignedRole = SUPER_ADMIN)
 */
export async function createAdmin(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireAssignedRole(auth, ['SUPER_ADMIN']);

  const body = parseBody(event) as CreateAdminBody;
  const { adminId, firstName, lastName, userName, emailAddress, password, phoneNumber } = body;

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
    phoneNumber: phoneNumber?.trim() || undefined,
    assignedRole: body.assignedRole || 'OPERATIONS_CLERK',
    accountStatus: body.accountStatus || 'active',
  });

  // Provision the Cognito user (owns the password; software-token MFA is
  // enforced by the pool on first sign-in). The plaintext password is known
  // here, so it becomes the admin's permanent pool password. When Cognito
  // isn't configured yet (env ids missing), skip rather than fail — run
  // `npm run provision:cognito` once configured.
  if (cognitoReady()) {
    try {
      const cognito = getCognitoGateway();
      const { sub } = await cognito.provisionUser({
        username: admin.emailAddress,
        password,
      });
      admin.cognitoSub = sub;
      await admin.save();
    } catch (err) {
      // Roll back the Mongo record so we don't leave an admin that can't
      // sign in while Cognito already holds the pool user.
      await admin.deleteOne().catch(() => null);
      throw err;
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn('[admins/create] Cognito not configured — skipped pool provisioning.');
  }

  return created(admin.toPublicJSON(), 'Admin created.');
}

export const handler = withErrorHandling(createAdmin);