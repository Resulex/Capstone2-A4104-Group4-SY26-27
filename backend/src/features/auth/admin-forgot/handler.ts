import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok, badRequest } from '../../../shared/responses';
import { serverError, badRequestError, forbiddenError } from '../../../shared/errors';
import { getCognitoGateway, cognitoReady, isCognitoOffline } from '../../../shared/cognito';
import { passwordPolicyViolation } from '../../../shared/password-policy';
import { hashPassword } from '../../../shared/password';
import { appBaseUrl, emailFromAddress, emailReady, sendPasswordResetEmail } from '../../../shared/email';
import {
  RESET_TOKEN_TTL_MINUTES,
  buildResetUrl,
  generateResetToken,
  hashResetToken,
  resetTokenExpiry,
} from '../../../shared/reset-token';
import { Admin } from '../../../models';

/**
 * Auth — Admin Forgot Password (link-based, emailed by Amazon SES)
 *
 * The backend owns the entire reset: it mints an opaque single-use token,
 * stores only its SHA-256 hash on the Admin document, and emails a link to
 * /admin/reset-password?token=…&email=… via SES. Nothing here depends on
 * Cognito's ForgotPassword codes or its message templates, so the email copy
 * lives in shared/email.ts and expiry is ours to control.
 *
 * Both steps stay deliberately vague about whether the email matches an
 * account (no user enumeration); diagnostics go to CloudWatch instead.
 */

/**
 * The single response returned by the request step — identical for a real
 * account, an unknown email, and a skipped admin, so the endpoint cannot be
 * used to probe addresses.
 */
function resetRequested(): APIGatewayProxyResult {
  return ok(
    { message: 'If an account exists, a password recovery email has been sent.' },
    'Reset requested.'
  );
}

/** POST /auth/admin/forgot-password — email a reset link. */
async function requestReset(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as { email?: string };
  const email = (body.email || '').trim().toLowerCase();
  if (!email) return badRequest('Email is required.');

  await connectToDatabase();

  // Diagnostics only — every branch still returns the same generic response.
  const admin = await Admin.findOne({ emailAddress: email });
  if (!admin) {
    console.warn(`[admin-forgot] no admin record for ${email}; no email sent.`);
    return resetRequested();
  }
  if (admin.accountStatus !== 'active') {
    console.warn(`[admin-forgot] ${email} is ${admin.accountStatus}; not sending a reset link.`);
    return resetRequested();
  }
  if (!admin.cognitoSub && !isCognitoOffline()) {
    // The confirm step writes to the pool user, so an unlinked admin could not
    // finish the reset anyway. Offline there is no pool, so this is expected.
    console.warn(`[admin-forgot] ${email} has no cognitoSub; the pool user does not exist.`);
    return resetRequested();
  }
  if (!emailReady()) {
    console.warn('[admin-forgot] SES_FROM_ADDRESS is not set; no email sent.');
    return resetRequested();
  }

  const token = generateResetToken();
  admin.passwordResetTokenHash = hashResetToken(token);
  admin.passwordResetExpiresAt = resetTokenExpiry();
  admin.passwordResetRequestedAt = new Date();
  await admin.save();

  const resetUrl = buildResetUrl(appBaseUrl(), token, admin.emailAddress);
  // Always logged, so local testing works even when SES is unreachable or the
  // recipient sits outside the SES sandbox.
  console.warn(`[admin-forgot] reset link f()or ${email}: ${resetUrl}`);

  try {
    await sendPasswordResetEmail({
      to: admin.emailAddress,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });
  } catch (err) {
    // Anti-enumeration: still report the generic success. The reason is in the
    // logs (sandbox restriction, unverified identity, missing ses:SendEmail…).
    console.error(
      `[admin-forgot] SES send to ${email} failed (from ${emailFromAddress()}):`,
      (err as Error)?.message || err
    );
  }
  return resetRequested();
}

/** POST /auth/admin/forgot-password/confirm — set the new password. */
async function confirmReset(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as { token?: string; newPassword?: string };
  const token = (body.token || '').trim();
  const newPassword = body.newPassword || '';
  if (!token || !newPassword) {
    return badRequest('token and newPassword are required.');
  }

  // Check the pool policy locally so a weak password is reported as a password
  // problem rather than a bad link. Cognito still enforces the real policy.
  const policyViolation = passwordPolicyViolation(newPassword);
  if (policyViolation) {
    return badRequest(policyViolation);
  }

  await connectToDatabase();

  const admin = await Admin.findOne({ passwordResetTokenHash: hashResetToken(token) });
  if (!admin || !admin.passwordResetExpiresAt || admin.passwordResetExpiresAt.getTime() < Date.now()) {
    throw badRequestError(
      'This password reset link is invalid or has expired. Request a new one.'
    );
  }
  if (admin.accountStatus !== 'active') {
    throw forbiddenError('This admin account is not active.');
  }

  if (!cognitoReady()) {
    throw serverError('Cognito is not configured.');
  }
  // Cognito owns the admin password; this does not touch TOTP enrollment, so an
  // admin who also lost their authenticator still needs `npm run reset:mfa`.
  await getCognitoGateway().setPassword(admin.emailAddress, newPassword);

  // Mirror into Mongo: the offline stub signs in against this hash, and the
  // single-use token is burned by clearing it.
  admin.passwordHash = await hashPassword(newPassword);
  admin.passwordResetTokenHash = undefined;
  admin.passwordResetExpiresAt = undefined;
  // The admin chose this password themselves, so no forced change remains.
  admin.mustChangePassword = false;
  await admin.save();

  return ok({ message: 'Password reset successfully.' }, 'Password reset.');
}

export const forgotPasswordHandler = withErrorHandling(requestReset);
export const confirmPasswordResetHandler = withErrorHandling(confirmReset);
