import 'dotenv/config';
import { Admin } from '../models';
import { connectToDatabase, disconnectDatabase } from '../config/db';
import { getCognitoGateway, isCognitoOffline } from '../shared/cognito';

/**
 * Reset software-token (TOTP / Google Authenticator) MFA for admins in the
 * AWS Cognito User Pool.
 *
 * WHY THIS EXISTS
 * ---------------
 * After admin auth + MFA moved to Cognito, a migrated admin can end up with a
 * software token *registered* in the pool (for example a test/dev enrollment
 * completed without the human ever scanning the QR). Cognito then returns
 * SOFTWARE_TOKEN_MFA at sign-in, so the app shows the "Verification" (enter a
 * 6-digit code) step instead of the "Authenticator Setup" QR step — and every
 * code fails with "Invalid or expired verification code" because no one holds
 * the secret.
 *
 * This script calls AdminDeleteSoftwareToken for each targeted admin. On the
 * next sign-in the pool (MFA required, TOTP only) returns an MFA_SETUP
 * challenge, so the admin is prompted to scan a fresh QR and re-enroll via
 * POST /auth/admin/login/totp/setup + /totp/verify (which signs them in).
 *
 * NOTE: AdminSetUserMFAPreference does NOT remove an existing TOTP token —
 * AdminDeleteSoftwareToken is the correct reset operation (AWS docs).
 *
 * TARGETING (default): active admins already provisioned into the pool
 *   (cognitoSub set). Override with positional email arguments:
 *     npm run reset:mfa
 *     npm run reset:mfa ricardo.delacruz@... admin2@...
 *     npm run reset:mfa -- --all          # every active admin (harmless no-op
 *                                         #   for admins with no token yet)
 *     npm run reset:mfa -- --dry-run      # preview only
 *
 * PREREQUISITES
 *   - COGNITO_OFFLINE must be unset/false (this targets the live pool).
 *   - COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID + MONGODB_URI in backend/.env.
 *   - The AWS credentials used must allow cognito-idp:AdminDeleteSoftwareToken
 *     on the user pool (add it to the same policy that grants the other
 *     cognito-idp actions).
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const emails = args.filter((a) => !a.startsWith('--'));
  const all = flags.includes('--all');
  const dryRun = flags.includes('--dry-run');

  if (isCognitoOffline()) {
    console.error(
      'Cannot reset a live pool while COGNITO_OFFLINE=true. Unset it first.'
    );
    process.exit(1);
  }
  if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID) {
    console.error(
      'COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID are not set. Create the pool\n' +
        'and app client in the AWS console (docs/COGNITO_AWS_CONSOLE.md), then\n' +
        'paste the ids into .env.'
    );
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await connectToDatabase();

  let query;
  if (emails.length > 0) {
    const normalized = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
    query = { emailAddress: { $in: normalized } };
  } else if (all) {
    query = { accountStatus: 'active' };
  } else {
    // Default: migrated (provisioned) active admins.
    query = { accountStatus: 'active', cognitoSub: { $exists: true, $ne: null } };
  }

  const admins = await Admin.find(query);

  console.log(`Resetting software-token MFA for ${admins.length} admin(s)...`);

  const cognito = getCognitoGateway();

  for (const admin of admins) {
    const username = admin.emailAddress;

    if (dryRun) {
      console.log(`  [dry-run] would reset ${username}`);
      continue;
    }

    try {
      await cognito.deleteSoftwareToken(username);
      // Mirror the un-enrolled state in Mongo (best effort) so the Admin
      // profile + offline dev reflect reality (real-pool login ignores this
      // flag; Cognito is the source of truth).
      if (admin.mfaEnrolled) {
        admin.mfaEnrolled = false;
        await admin.save().catch(() => null);
      }
      console.log(`  [ok] ${username} — next sign-in will ask to scan a new QR`);
    } catch (err) {
      console.error(`  [error] ${username}: ${(err as Error)?.message || err}`);
    }
  }

  await disconnectDatabase();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('MFA reset failed:', err);
    process.exit(1);
  });
