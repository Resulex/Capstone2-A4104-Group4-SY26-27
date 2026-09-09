import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import {
  badRequestError,
  unauthorizedError,
  forbiddenError,
} from '../../../shared/errors';
import { Admin } from '../../../models';
import { getCognitoGateway } from '../../../shared/cognito';

interface TotpSetupBody {
  /** Either `userName` or `emailAddress` — at least one is required. */
  userName?: string;
  emailAddress?: string;
  /** Opaque MFA_SETUP session returned by POST /auth/admin/login. */
  session?: string;
}

interface TotpVerifyBody extends TotpSetupBody {
  /** 6-digit TOTP code from the admin's authenticator app. */
  code?: string;
}

const TOTP_ISSUER = process.env.TOTP_ISSUER || 'KaBarangayConnect';

/** Build an otpauth:// provisioning URI for the QR code from a base32 secret. */
function buildOtpauthUri(username: string, secret: string): string {
  const label = `${TOTP_ISSUER}:${username}`;
  const params = new URLSearchParams({
    secret,
    issuer: TOTP_ISSUER,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

/** Resolve an active admin by userName|email (throws if missing/inactive). */
async function findActiveAdmin(userName?: string, emailAddress?: string) {
  const identifier = (userName?.trim() || emailAddress?.trim() || '').toLowerCase();
  if (!identifier) {
    throw badRequestError('A username or email is required.');
  }
  await connectToDatabase();
  const admin = await Admin.findOne({
    $or: [
      { userName: userName?.trim() },
      { emailAddress: identifier },
    ],
  });
  if (!admin) {
    throw unauthorizedError('Invalid credentials.');
  }
  if (admin.accountStatus !== 'active') {
    throw forbiddenError('This admin account is not active.');
  }
  return admin;
}

/**
 * Auth — Admin Login TOTP Setup (step 2a)
 *
 * Use-case: begin TOTP (Google Authenticator) enrollment for an admin whose
 * password was verified but who has no authenticator yet (MFA_SETUP). Asks
 * Cognito to associate a software token and returns the provisioning URI +
 * raw base32 secret so the client can render a QR code.
 *
 * POST /auth/admin/login/totp/setup
 * Body: { userName|emailAddress, session }
 *
 * - 200 { data:{ otpauthUrl, secret, session } } — ready to scan.
 * - 401 — invalid/expired session.
 */
export async function adminTotpSetup(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as TotpSetupBody;
  const { userName, emailAddress, session } = body;
  if (!session) {
    throw badRequestError('A session is required.');
  }

  const admin = await findActiveAdmin(userName, emailAddress);
  const username = admin.emailAddress;

  const cognito = getCognitoGateway();
  const { secretCode, session: nextSession } = await cognito.startTotpSetup(session);

  return ok(
    {
      otpauthUrl: buildOtpauthUri(username, secretCode),
      secret: secretCode,
      session: nextSession,
    },
    'Scan the QR code with your authenticator app (e.g. Google Authenticator).'
  );
}

/**
 * Auth — Admin Login TOTP Verify (step 2b)
 *
 * Use-case: confirm the admin can produce codes with the new authenticator
 * and enable software-token MFA for the account. The admin then signs in
 * again (step 1) and completes with a normal 6-digit code via /login/mfa.
 *
 * POST /auth/admin/login/totp/verify
 * Body: { userName|emailAddress, session, code }
 *
 * - 200 { data:{ setupComplete:true } } — authenticator registered.
 * - 401 — invalid/expired session or code.
 */
export async function adminTotpVerify(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as TotpVerifyBody;
  const { userName, emailAddress, session, code } = body;
  if (!session || !code) {
    throw badRequestError('A session and verification code are required.');
  }

  const admin = await findActiveAdmin(userName, emailAddress);
  const username = admin.emailAddress;

  const cognito = getCognitoGateway();
  const { sub } = await cognito.completeTotpSetup(username, session, code);

  // Link the Cognito sub if this admin was provisioned before it was stored.
  if (!admin.cognitoSub) {
    admin.cognitoSub = sub;
    await admin.save().catch(() => null);
  }

  return ok(
    { setupComplete: true },
    'Two-factor authentication is enabled. Sign in again to continue.'
  );
}

export const setupTotpHandler = withErrorHandling(adminTotpSetup);
export const verifyTotpHandler = withErrorHandling(adminTotpVerify);
