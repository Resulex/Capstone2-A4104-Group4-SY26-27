import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../../config/db';
import { withErrorHandling, parseBody } from '../../../../shared/handler';
import { ok } from '../../../../shared/responses';
import { badRequestError, unauthorizedError, forbiddenError } from '../../../../shared/errors';
import { hashPassword } from '../../../../shared/password';
import { passwordPolicyViolation } from '../../../../shared/password-policy';
import { Admin } from '../../../../models';
import { getCognitoGateway } from '../../../../shared/cognito';

interface NewPasswordBody {
  /** Either `userName` or `emailAddress` — at least one is required. */
  userName?: string;
  emailAddress?: string;
  /** Opaque NEW_PASSWORD_REQUIRED session returned by POST /auth/admin/login. */
  session?: string;
  /** The admin's chosen replacement password. */
  newPassword?: string;
}

/**
 * Auth — Admin Login New Password (first sign-in)
 *
 * Use-case: answer the Cognito NEW_PASSWORD_REQUIRED challenge. A newly
 * provisioned admin receives a temporary password by email; the first sign-in
 * with it returns this challenge, so the admin must choose their own password
 * before the software-token (TOTP) enrollment continues.
 *
 * POST /auth/admin/login/new-password
 * Body: { userName|emailAddress, session, newPassword }
 *
 * Responses (HTTP 200 unless otherwise noted):
 * - 200 { data:{ needsTotp|needsTotpSetup, session } } — password changed; the
 *   client continues with the usual MFA challenge / QR enrollment.
 * - 400 — missing fields or a password below the pool policy.
 * - 401 — invalid/expired session.
 * - 403 — the admin account is not active.
 *
 * Public: the short-lived challenge `session` replaces the password, so no
 * authorizer is attached (matching the MFA / TOTP handlers).
 */
export async function adminNewPassword(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as NewPasswordBody;
  const { userName, emailAddress, session, newPassword } = body;

  if (!session || !newPassword) {
    throw badRequestError('A session and a new password are required.');
  }
  // Check the pool policy locally so an obvious failure returns 400 without a
  // round-trip (Cognito still enforces the authoritative policy).
  const policyViolation = passwordPolicyViolation(newPassword);
  if (policyViolation) {
    throw badRequestError(policyViolation);
  }

  const identifier = (userName?.trim() || emailAddress?.trim() || '').toLowerCase();
  if (!identifier) {
    throw badRequestError('A username or email is required.');
  }

  await connectToDatabase();

  // Re-resolve the admin so account status is re-checked and we know the
  // Cognito username (the admin's emailAddress).
  const admin = await Admin.findOne({
    $or: [{ userName: userName?.trim() }, { emailAddress: identifier }],
  });
  if (!admin) {
    throw unauthorizedError('Invalid credentials.');
  }
  if (admin.accountStatus !== 'active') {
    throw forbiddenError('This admin account is not active.');
  }

  const cognito = getCognitoGateway();
  const result = await cognito.respondToNewPassword(admin.emailAddress, session, newPassword);

  // Mirror the new credential into Mongo: offline sign-in verifies this hash,
  // so it must not go stale after a first-login change. Best-effort — the pool
  // already accepted the password.
  admin.passwordHash = await hashPassword(newPassword);
  // The pool already cleared FORCE_CHANGE_PASSWORD; mirror that in Mongo so the
  // offline stub stops demanding a change too.
  admin.mustChangePassword = false;
  await admin.save().catch(() => null);

  if (result.challenge === 'SOFTWARE_TOKEN_MFA') {
    return ok(
      { authenticated: false, needsTotp: true, session: result.session },
      'Password updated. Enter the 6-digit code from your authenticator app.'
    );
  }

  return ok(
    { authenticated: false, needsTotpSetup: true, session: result.session },
    'Password updated. Scan the QR code to set up two-factor authentication.'
  );
}

export const handler = withErrorHandling(adminNewPassword);
