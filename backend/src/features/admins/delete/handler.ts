import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError, forbiddenError } from '../../../shared/errors';
import { Admin } from '../../../models';
import { resolveAuthContext, requireAssignedRole } from '../../../shared/authorization';
import { getCognitoGateway, cognitoReady } from '../../../shared/cognito';

/**
 * Admins — Delete
 * Use-case: delete an admin account. Only the top-tier 'SUPER_ADMIN' role
 * may do this, and it cannot delete itself.
 * DELETE /admins/{id} (admin, assignedRole = SUPER_ADMIN)
 */
export async function deleteAdmin(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireAssignedRole(auth, ['SUPER_ADMIN']);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const admin = await Admin.findOne(buildIdOrCustomIdQuery(id, 'adminId'));
  if (!admin) {
    throw notFoundError('Admin not found.');
  }

  // Prevent an admin from deleting their own account.
  if (auth.admin?.adminId === admin.adminId || String(admin._id) === auth.userId) {
    throw forbiddenError('You cannot delete your own admin account.');
  }

  await admin.deleteOne();

  // Remove the matching pool user so the email can be reused later.
  if (cognitoReady()) {
    try {
      await getCognitoGateway().deleteUser(admin.emailAddress);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[admins/delete] Cognito cleanup failed:', (err as Error)?.message || err);
    }
  }

  return ok({ deleted: admin.adminId }, 'Admin deleted.');
}

export const handler = withErrorHandling(deleteAdmin);