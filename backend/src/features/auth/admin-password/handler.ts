import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok, badRequest } from '../../../shared/responses';
import { notFoundError, serverError } from '../../../shared/errors';
import { hashPassword } from '../../../shared/password';
import { passwordPolicyViolation } from '../../../shared/password-policy';
import { getCognitoGateway, cognitoReady } from '../../../shared/cognito';
import { resolveAuthContext, requireAdmin } from '../../../shared/authorization';
import { Admin } from '../../../models';

interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Auth — Admin Change Password (self-service)
 * Use-case: the signed-in admin changes their OWN password, proving they know
 * the current one.
 * PATCH /auth/admin/password  (admin only, auth-jwt)
 *
 * Why a dedicated endpoint instead of `PATCH /admins/{id}`: that route is the
 * admin-management surface, where a SUPER_ADMIN resets ANOTHER admin's password
 * and therefore has no current password to supply. This one is self-scoped to
 * the JWT subject, so there is no id to tamper with.
 *
 * The current password is verified against COGNITO, not the Mongo
 * `Admin.passwordHash`: the real pool does not mirror that hash, so Mongo goes
 * stale after a forgot-password reset and would reject the CORRECT password.
 *
 * A wrong current password is answered 400 — deliberately never 401/403.
 * `/api/backend/[...path]` treats those as a dead session and clears the
 * `kbc_token` cookie, which would silently sign the admin out.
 */
async function changeAdminPassword(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as ChangePasswordBody;
  const currentPassword = body.currentPassword || '';
  const newPassword = body.newPassword || '';
  if (!currentPassword || !newPassword) {
    return badRequest('currentPassword and newPassword are required.');
  }

  // Check the pool policy locally so a weak password is reported against the
  // password field instead of surfacing as Cognito's opaque rejection.
  const policyViolation = passwordPolicyViolation(newPassword);
  if (policyViolation) {
    return badRequest(policyViolation);
  }

  // Loads the Admin record for the caller. `resolveAuthContext` only loads the
  // admin context when the role IS admin, so require the role explicitly — a
  // resident/official session JWT must never reach this handler.
  const auth = await resolveAuthContext(event);
  requireAdmin(auth);

  // Fail closed rather than reporting a change that never happened.
  if (!cognitoReady()) {
    throw serverError('Cognito is not configured.');
  }

  await connectToDatabase();
  // The session JWT `sub` is the Mongo `_id`; `buildIdOrCustomIdQuery` also
  // tolerates a `ADM-XXXXX` adminId should the subject ever change.
  const admin = await Admin.findOne(buildIdOrCustomIdQuery(auth.userId, 'adminId'));
  if (!admin) {
    throw notFoundError('Admin not found.');
  }

  const cognito = getCognitoGateway();

  if (!(await cognito.verifyPassword(admin.emailAddress, currentPassword))) {
    return badRequest('Current password is incorrect.');
  }
  if (currentPassword === newPassword) {
    return badRequest('The new password must be different from the current password.');
  }

  // Pool first, then the Mongo mirror. Cognito is authoritative, so a failure
  // there must not report success (unlike the best-effort sync in
  // `admins/update`). The Mongo write is still required: the offline stub's
  // `setPassword()` is a no-op, so this hash is what keeps local sign-in
  // working. This order never strands the admin — an unlikely Mongo failure
  // after a pool success only affects the offline path.
  await cognito.setPassword(admin.emailAddress, newPassword);
  admin.passwordHash = await hashPassword(newPassword);
  await admin.save();

  return ok({ message: 'Password updated.' }, 'Password updated.');
}

export const handler = withErrorHandling(changeAdminPassword);
