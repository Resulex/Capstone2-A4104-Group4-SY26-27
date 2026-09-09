import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok, badRequest } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { hashPassword } from '../../../shared/password';
import { Admin } from '../../../models';
import { resolveAuthContext, requireAssignedRole } from '../../../shared/authorization';
import { getCognitoGateway, cognitoReady } from '../../../shared/cognito';

interface UpdateAdminBody {
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
 * Admins — Update
 * Use-case: update an admin account. Role/status changes require the top-tier
 * 'SUPER_ADMIN' assigned role; basic profile edits allow any admin.
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
    requireAssignedRole(auth, ['SUPER_ADMIN']);
  }

  // Email is the Cognito sign-in name for provisioned admins. Changing it
  // in-place would silently break their pool login, so block it (a top-tier
  // Admin can delete + recreate instead).
  if (body.emailAddress !== undefined) {
    const newEmail = body.emailAddress.toLowerCase();
    if (admin.cognitoSub && newEmail !== admin.emailAddress) {
      throw badRequest(
        'Email is the Cognito sign-in name and cannot be changed on a provisioned account. Delete and recreate the admin instead.'
      );
    }
  }

  if (body.firstName !== undefined) admin.firstName = body.firstName;
  if (body.lastName !== undefined) admin.lastName = body.lastName;
  if (body.middleName !== undefined) admin.middleName = body.middleName;
  if (body.userName !== undefined) admin.userName = body.userName;
  if (body.emailAddress !== undefined) admin.emailAddress = body.emailAddress.toLowerCase();
  if (body.phoneNumber !== undefined) admin.phoneNumber = body.phoneNumber.trim();
  if (body.assignedRole !== undefined) admin.assignedRole = body.assignedRole;
  if (body.accountStatus !== undefined) admin.accountStatus = body.accountStatus;
  if (body.password !== undefined) {
    admin.passwordHash = await hashPassword(body.password);
  }

  await admin.save();

  // Sync password / status to the Cognito pool. Best-effort and non-fatal:
  // Mongo stays the profile source of truth, and the provision script can
  // reconcile any drift. (phoneNumber is stored in Mongo only — software-token
  // MFA does not need it in the pool.)
  if (cognitoReady()) {
    const cognito = getCognitoGateway();
    const username = admin.emailAddress;
    try {
      if (body.password !== undefined) {
        await cognito.setPassword(username, body.password);
      }
      if (body.accountStatus !== undefined) {
        await cognito.setAccountStatus(username, admin.accountStatus);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[admins/update] Cognito sync failed:', (err as Error)?.message || err);
    }
  }

  return ok(admin.toPublicJSON(), 'Admin updated.');
}

export const handler = withErrorHandling(updateAdmin);