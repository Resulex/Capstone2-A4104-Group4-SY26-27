import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import {
  unauthorizedError,
  forbiddenError,
  serverError,
} from '../../../shared/errors';
import { Admin } from '../../../models';
import { getCognitoGateway } from '../../../shared/cognito';

interface AdminLoginBody {
  /** Either `userName` or `emailAddress` — at least one is required. */
  userName?: string;
  emailAddress?: string;
  password?: string;
}

/**
 * Auth — Admin Login (step 1: credentials)
 *
 * Use-case: verify an admin's password against AWS Cognito. Cognito owns the
 * credential + software-token (TOTP/Google Authenticator) challenge; the app
 * keeps its own session JWT, so the API Gateway authorizer / RBAC / resident
 * flow are untouched.
 *
 * POST /auth/admin/login
 * Body: { userName|emailAddress, password }
 *
 * Responses (HTTP 200 unless otherwise noted):
 * - 200 { data:{ authenticated:false, needsTotp:true, session } } — password
 *   verified + a TOTP authenticator is enrolled; prompt for the 6-digit code
 *   and complete via POST /auth/admin/login/mfa.
 * - 200 { data:{ authenticated:false, needsTotpSetup:true, session } } —
 *   password verified but no TOTP authenticator yet; run the QR setup
 *   (POST /auth/admin/login/totp/setup then /totp/verify), then re-login.
 * - 401 — invalid credentials.
 * - 403 — the admin account is not active.
 *
 * The Cognito challenge `session` is an opaque, short-lived string returned
 * to the client and passed back once in a follow-up call. The Lambda stores
 * nothing (stateless).
 */
export async function adminLogin(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as AdminLoginBody;
  const { userName, emailAddress, password } = body;

  const identifier = (userName?.trim() || emailAddress?.trim() || '').toLowerCase();
  if (!identifier || !password) {
    throw unauthorizedError('Username/email and password are required.');
  }

  await connectToDatabase();

  // The Mongo Admin is still the profile/role source of truth (accountStatus,
  // assignedRole). Cognito only authenticates the password + SMS MFA.
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

  // Cognito's username for an admin is their emailAddress. Offline mode
  // verifies the Mongo bcrypt hash and returns the dev TOTP code 123456.
  const username = foundAdmin.emailAddress;
  const cognito = getCognitoGateway();
  const result = await cognito.initiateAuth(username, password);

  // Enrolled → hand the challenge session back; the client asks for the code.
  if (result.challenge === 'SOFTWARE_TOKEN_MFA') {
    return ok(
      {
        authenticated: false,
        needsTotp: true,
        session: result.session,
      },
      'Enter the 6-digit code from your authenticator app.'
    );
  }

  // Not enrolled → the client runs the TOTP QR setup before signing in.
  if (result.challenge === 'MFA_SETUP') {
    return ok(
      {
        authenticated: false,
        needsTotpSetup: true,
        session: result.session,
      },
      'Two-factor authentication is not set up. Scan the QR code to enroll.'
    );
  }

  // Fail closed: step 1 must never issue a session token. Every successful
  // password check is followed by a TOTP challenge — SOFTWARE_TOKEN_MFA when
  // the admin is enrolled, MFA_SETUP when they still need to scan the QR.
  // Reaching this point means the Cognito gateway returned no challenge (e.g.
  // the user pool is not enforcing MFA) — surface an error instead of signing
  // the admin in without a 6-digit code.
  throw serverError(
    'Unexpected authentication state: no multi-factor challenge was returned. Please contact an administrator.'
  );
}

export const handler = withErrorHandling(adminLogin);