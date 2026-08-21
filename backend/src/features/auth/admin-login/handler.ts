import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { unauthorizedError, forbiddenError, serverError } from '../../../shared/errors';
import { Admin } from '../../../models';
import { comparePassword } from '../../../shared/password';
import { signToken } from '../../../shared/auth';
import { decryptTotpSecret, assertValidTotp } from '../../../shared/totp';

/** TTL for the short-lived enrollment JWT (defaults to 10 minutes). */
const ENROLLMENT_JWT_TTL = process.env.TOTP_ENROLLMENT_JWT_TTL || '10m';

interface AdminLoginBody {
  /** Either `userName` or `emailAddress` — at least one is required. */
  userName?: string;
  emailAddress?: string;
  password?: string;
  /** TOTP 6-digit code from Google Authenticator. Required when MFA is enrolled. */
  code?: string;
  /** One of the backup codes issued at enrollment. */
  backupCode?: string;
}

/**
 * Auth — Admin Login
 * Use-case: authenticate an admin via userName/email + password, then step-up
 * with a TOTP code before issuing a full-session JWT.
 *
 * POST /auth/admin/login
 * Body: { userName|emailAddress, password, code?, backupCode? }
 *
 * Responses (all with HTTP 200 unless otherwise noted):
 * - 200 { data:{ token, user } } — fully authenticated (MFA enrolled + valid code).
 * - 200 { data:{ authenticated:false, needsSetup:true, enrollmentJwt } } —
 *   credentials valid but MFA not yet enrolled; the caller must run TOTP setup.
 * - 200 { data:{ authenticated:false, needsSetup:false } } — credentials valid,
 *   MFA enrolled, but no code/backupCode supplied yet (prompt for the code).
 * - 401 — invalid credentials, or a wrong/invalid authenticator/backup code.
 * - 403 — the admin account is not active.
 */
export async function adminLogin(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as AdminLoginBody;
  const { userName, emailAddress, password, code, backupCode } = body;

  const identifier = (userName?.trim() || emailAddress?.trim() || '').toLowerCase();
  if (!identifier || !password) {
    throw unauthorizedError('Username/email and password are required.');
  }

  await connectToDatabase();

  // passwordHash, totpSecret, and backupCodes all have `select: false`, so
  // select them explicitly. Match on either the username or email address.
  const foundAdmin = await Admin.findOne({
    $or: [
      { userName: userName?.trim() },
      { emailAddress: identifier },
    ],
  }).select('+passwordHash +totpSecret +backupCodes');

  if (!foundAdmin) {
    throw unauthorizedError('Invalid credentials.');
  }

  if (foundAdmin.accountStatus !== 'active') {
    throw forbiddenError('This admin account is not active.');
  }

  const passwordMatches = await comparePassword(password, foundAdmin.passwordHash);
  if (!passwordMatches) {
    throw unauthorizedError('Invalid credentials.');
  }

  // MFA not enrolled yet — issue a short-lived enrollment JWT so the client
  // can call the JWT-protected TOTP setup/verify endpoints (chicken-and-egg
  // resolved). This token is NOT a full session token.
  if (!foundAdmin.totpSecret) {
    const enrollmentJwt = signToken(
      String(foundAdmin.id),
      'admin',
      ENROLLMENT_JWT_TTL,
    );
    return ok(
      { authenticated: false, needsSetup: true, enrollmentJwt },
      'MFA is not enabled. Enroll a TOTP authenticator first.'
    );
  }

  // MFA enrolled but no code supplied yet — tell the client to prompt for it.
  if (!code && !backupCode) {
    return ok({ authenticated: false, needsSetup: false });
  }

  let mfaOk = false;
  if (code) {
    let secret: string;
    try {
      secret = decryptTotpSecret(foundAdmin.totpSecret);
    } catch {
      throw serverError('Unable to read authenticator configuration.');
    }
    await assertValidTotp(code, secret);
    mfaOk = true;
  } else if (backupCode && foundAdmin.backupCodes?.length) {
    // Compare the backup code against the stored bcrypt hashes.
    const matches = await Promise.all(
      foundAdmin.backupCodes.map((hash) => comparePassword(backupCode, hash))
    );
    mfaOk = matches.some(Boolean);
  }

  if (!mfaOk) {
    // Wrong code — keep message generic.
    throw unauthorizedError('Invalid or missing authenticator code.');
  }

  // Record last login (best-effort; don't fail login on a write error).
  foundAdmin.lastLogin = new Date();
  await foundAdmin.save().catch(() => null);

  // `sub` carries the admin's stable internal id (adminId). The authorizer's
  // loadAdminContext resolves the Admin document via adminId/_id regardless.
  const token = signToken(String(foundAdmin.id), 'admin');

  return ok(
    { token, user: foundAdmin.toPublicJSON() },
    'Admin login successful.'
  );
}

export const handler = withErrorHandling(adminLogin);