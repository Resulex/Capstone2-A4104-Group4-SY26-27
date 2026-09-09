import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { badRequestError, unauthorizedError, forbiddenError } from '../../../shared/errors';
import { Admin } from '../../../models';
import { signToken } from '../../../shared/auth';
import { getCognitoGateway } from '../../../shared/cognito';

interface AdminLoginMfaBody {
  /** Either `userName` or `emailAddress` — at least one is required. */
  userName?: string;
  emailAddress?: string;
  /** Opaque SMS_MFA session returned by POST /auth/admin/login. */
  session?: string;
  /** 6-digit code texted by Cognito (or the offline dev code). */
  code?: string;
}

/**
 * Auth — Admin Login MFA (step 2: authenticator code)
 *
 * Use-case: complete an admin login by responding to the Cognito
 * SOFTWARE_TOKEN_MFA challenge with the 6-digit TOTP code from the admin's
 * authenticator app. On success a full-session JWT is issued.
 *
 * POST /auth/admin/login/mfa
 * Body: { userName|emailAddress, session, code }
 *
 * Responses:
 * - 200 { data:{ token, user } } — fully authenticated.
 * - 400 — missing session/code/identifier.
 * - 401 — invalid/expired session or code, or unknown credentials.
 * - 403 — the admin account is not active.
 */
export async function adminLoginMfa(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as AdminLoginMfaBody;
  const { userName, emailAddress, session, code } = body;

  if (!session || !code) {
    throw badRequestError('A session and verification code are required.');
  }
  const identifier = (userName?.trim() || emailAddress?.trim() || '').toLowerCase();
  if (!identifier) {
    throw badRequestError('A username or email is required.');
  }

  await connectToDatabase();

  // Re-resolve the admin so account status is re-checked and we know the
  // Cognito username (the admin's emailAddress) for the challenge response.
  const foundAdmin = await Admin.findOne({
    $or: [
      { userName: userName?.trim() },
      { emailAddress: identifier },
    ],
  });
  if (!foundAdmin) {
    throw unauthorizedError('Invalid credentials.');
  }
  if (foundAdmin.accountStatus !== 'active') {
    throw forbiddenError('This admin account is not active.');
  }

  const cognito = getCognitoGateway();
  const username = foundAdmin.emailAddress;
  const { sub } = await cognito.respondToTotpChallenge(username, session, code);

  // Link by the Cognito `sub` when possible; fall back to the admin resolved
  // by identifier (covers records provisioned before cognitoSub was stored).
  let admin = foundAdmin;
  if (foundAdmin.cognitoSub) {
    if (foundAdmin.cognitoSub !== sub) {
      const bySub = await Admin.findOne({ cognitoSub: sub });
      if (bySub) admin = bySub;
    }
  } else {
    foundAdmin.cognitoSub = sub;
    admin = foundAdmin;
  }

  // Record last login + persist the cognitoSub link (best-effort; don't fail
  // login on a write error).
  admin.lastLogin = new Date();
  await admin.save().catch(() => null);

  // `sub` carries the admin's stable internal id (adminId). The authorizer's
  // loadAdminContext resolves the Admin document via adminId/_id regardless.
  const token = signToken(String(admin.id), 'admin');

  return ok(
    { token, user: admin.toPublicJSON() },
    'Admin login successful.'
  );
}

export const handler = withErrorHandling(adminLoginMfa);
