import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { Admin } from '../models';
import { connectToDatabase, disconnectDatabase } from '../config/db';
import { getCognitoGateway, isCognitoOffline } from '../shared/cognito';

/**
 * Provision Mongo `Admin` records into the AWS Cognito User Pool.
 *
 * For each eligible admin this:
 *   1. Creates the pool user (username = emailAddress).
 *   2. Sets a permanent password (skips the NEW_PASSWORD_REQUIRED challenge).
 *   3. Stores the Cognito `sub` on the Mongo Admin document (cognitoSub).
 *
 * MFA is NOT set up here — the pool is configured with software-token MFA
 * required (MfaConfiguration ON), so the admin is prompted to scan a QR code
 * (Google Authenticator) on their first sign-in.
 *
 * Password source:
 *   - If COGNITO_PROVISION_PASSWORD is set, every provisioned admin gets that
 *     shared initial password (convenient for a demo pool — tell admins to
 *     change it afterwards via the settings PATCH, which syncs to Cognito).
 *   - Otherwise a unique random password is generated per admin and printed
 *     to the console so you can share it privately.
 *
 * Eligibility (default):
 *   - accountStatus === 'active'
 *   - has no `cognitoSub` yet (already provisioned → skipped)
 * Use --all to force re-provisioning (resets the password for every active
 * admin to the source above).
 *
 * Usage:
 *   COGNITO_PROVISION_PASSWORD='...' npm run provision:cognito
 *   npm run provision:cognito -- --dry-run
 *   npm run provision:cognito -- --all
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const dryRun = args.includes('--dry-run');

  if (isCognitoOffline()) {
    console.error(
      'Cannot provision a live pool while COGNITO_OFFLINE=true. Unset it first.'
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

  const sharedPassword = process.env.COGNITO_PROVISION_PASSWORD || '';
  if (all && !sharedPassword) {
    console.error('--all resets passwords; set COGNITO_PROVISION_PASSWORD.');
    process.exit(1);
  }

  await connectToDatabase();

  const query = all ? { accountStatus: 'active' } : { accountStatus: 'active', cognitoSub: { $exists: false } };
  const admins = await Admin.find(query);

  console.log(`Provisioning ${admins.length} active admin(s) into Cognito...`);

  const cognito = getCognitoGateway();

  for (const admin of admins) {
    const username = admin.emailAddress;
    const password = sharedPassword || generateSecurePassword();

    if (dryRun) {
      console.log(
        `  [dry-run] would provision ${username}` +
          (password === sharedPassword ? '' : ` with password ${password}`)
      );
      continue;
    }

    try {
      const { sub } = await cognito.provisionUser({ username, password });
      admin.cognitoSub = sub;
      await admin.save();
      console.log(
        `  [ok] ${username} → sub ${sub}` +
          (sharedPassword
            ? ' (shared initial password)'
            : ` — initial password: ${password}`)
      );
    } catch (err) {
      console.error(`  [error] ${username}: ${(err as Error)?.message || err}`);
    }
  }

  await disconnectDatabase();
}

/** Random 16-char password satisfying the pool policy (upper/lower/digit). */
function generateSecurePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const bytes = randomBytes(13);
  const picked = Array.from(bytes, (b) => all[b % all.length]).join('');
  const ensured =
    upper[bytes[0] % upper.length] +
    lower[bytes[1] % lower.length] +
    digits[bytes[2] % digits.length];
  // First 13 chars (all sets) + 3 ensured chars to be safe = 16 total.
  return (ensured + picked).slice(0, 16);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Provisioning failed:', err);
    process.exit(1);
  });
