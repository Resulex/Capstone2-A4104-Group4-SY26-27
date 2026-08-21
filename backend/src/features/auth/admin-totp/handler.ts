import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { badRequestError, conflictError, unauthorizedError } from '../../../shared/errors';
import { Admin } from '../../../models';
import { resolveAuthContext, requireAdmin } from '../../../shared/authorization';
import { comparePassword, hashPassword } from '../../../shared/password';
import {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  verifyTotp,
} from '../../../shared/totp';

const BACKUP_CODE_COUNT = 8;

// ---------------------------------------------------------------------------
// Setup — generate + store a TOTP secret (step 1 of enrollment)
// ---------------------------------------------------------------------------

/**
 * Auth — Admin TOTP Setup
 * Use-case: generate a TOTP secret for an admin and return an otpauth:// URI so
 * they can scan it with Google Authenticator.
 *
 * POST /auth/admin/totp/setup  (admin only)
 */
export async function setupAdminTotp(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  await connectToDatabase();
  const auth = await resolveAuthContext(event);
  requireAdmin(auth);

  const admin = await Admin.findById(auth.userId);
  if (!admin) {
    throw unauthorizedError('Admin account not found.');
  }

  // If MFA is already verified, refuse to regenerate (prevents secret churn).
  if (admin.totpVerified) {
    throw conflictError('Two-factor authentication is already enabled.');
  }

  const { secret, otpauthUrl } = generateTotpSecret(
    `${admin.userName} (${admin.emailAddress})`
  );

  admin.totpSecret = encryptTotpSecret(secret);
  admin.totpVerified = false;
  await admin.save();

  // The raw base32 secret is shown exactly once so the user can add it
  // manually; it is never stored/returned afterwards.
  return ok({ secret, otpauthUrl }, 'Scan the QR code with Google Authenticator.');
}

// ---------------------------------------------------------------------------
// Verify — confirm the TOTP code and issue recovery codes (step 2)
// ---------------------------------------------------------------------------

interface VerifyTotpBody {
  code?: string;
}

/**
 * Auth — Admin TOTP Verify
 * Use-case: confirm the admin can generate codes with their new secret, mark
 * MFA as verified, and issue one-time backup codes (shown only once).
 *
 * POST /auth/admin/totp/verify  (admin only)
 * Body: { code }
 */
export async function verifyAdminTotp(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as VerifyTotpBody;
  const { code } = body;

  if (!code) {
    throw badRequestError('A verification code is required.');
  }

  await connectToDatabase();
  const auth = await resolveAuthContext(event);
  requireAdmin(auth);

  const admin = await Admin.findById(auth.userId).select('+totpSecret +backupCodes');
  if (!admin) {
    throw unauthorizedError('Admin account not found.');
  }
  if (!admin.totpSecret) {
    throw conflictError('TOTP is not set up. Run setup first.');
  }
  if (admin.totpVerified) {
    throw conflictError('Two-factor authentication is already verified.');
  }

  let secret: string;
  try {
    secret = decryptTotpSecret(admin.totpSecret);
  } catch {
    throw unauthorizedError('Unable to read authenticator configuration.');
  }

  const matches = await verifyTotp(code, secret);
  if (!matches) {
    throw unauthorizedError('Invalid verification code.');
  }

  // Generate and persist (bcrypt-hashed) backup codes. Plaintext shown once.
  const plaintextCodes: string[] = [];
  const hashedCodes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i += 1) {
    const plain = generateBackupCode();
    plaintextCodes.push(plain);
    hashedCodes.push(await hashPassword(plain));
  }

  admin.totpVerified = true;
  admin.backupCodes = hashedCodes;
  await admin.save();

  return ok(
    { backupCodes: plaintextCodes },
    'Two-factor authentication enabled. Store these backup codes somewhere safe.'
  );
}

/** Generates a human-friendly backup code, e.g. XXXX-XXXX-XXXX. */
function generateBackupCode(): string {
  const segment = () =>
    Math.floor(0x1000 + Math.random() * 0xf000)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0');
  return `${segment()}-${segment()}-${segment()}`;
}

export const setupTotpHandler = withErrorHandling(setupAdminTotp);
export const verifyTotpHandler = withErrorHandling(verifyAdminTotp);