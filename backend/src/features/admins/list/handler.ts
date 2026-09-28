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

  // Project the same public shape as `Admin.toPublicJSON()`: `.lean()` bypasses
  // that method, so without an explicit projection the internal Cognito / MFA /
  // password-reset-link fields would be sent to every admin client.
  const admins = await Admin.find()
    .select(
      '-passwordHash -cognitoSub -mfaEnrolled -totpSecret -backupCodes ' +
        '-passwordResetTokenHash -passwordResetExpiresAt -passwordResetRequestedAt ' +
        '-mustChangePassword'
    )
    .lean();

  return ok(admins, 'Admins fetched.');
}

export const handler = withErrorHandling(listAdmins);