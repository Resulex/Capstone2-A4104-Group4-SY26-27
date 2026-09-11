import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { randomBytes } from 'node:crypto';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError } from '../../../shared/errors';
import { hashPassword } from '../../../shared/password';
import { Admin, type IAdmin } from '../../../models';
import { resolveAuthContext, requireAssignedRole } from '../../../shared/authorization';
import { getCognitoGateway, cognitoReady } from '../../../shared/cognito';
import {
  appBaseUrl,
  emailFromAddress,
  emailReady,
  sendAdminInviteEmail,
} from '../../../shared/email';

interface CreateAdminBody {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  userName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  assignedRole?: 'SUPER_ADMIN' | 'OPERATIONS_CLERK' | 'INFO_OFFICER';
  accountStatus?: 'active' | 'suspended' | 'deactivated';
}

/** Fields a client may set when creating an admin (adminId is generated). */
type NewAdminFields = Pick<
  IAdmin,
  | 'firstName'
  | 'lastName'
  | 'middleName'
  | 'userName'
  | 'emailAddress'
  | 'passwordHash'
  | 'phoneNumber'
  | 'assignedRole'
  | 'accountStatus'
>;

/** Builds the next sequential admin id (ADM-00001). */
async function nextAdminId(): Promise<string> {
  const last = await Admin.findOne({ adminId: /^ADM-\d{5}$/ })
    .sort({ adminId: -1 })
    .select('adminId')
    .lean();
  const seq = last ? parseInt(last.adminId.slice(4), 10) + 1 : 1;
  return `ADM-${String(seq).padStart(5, '0')}`;
}

/** Random element of a character set (crypto-backed, no modulo bias concerns
 *  at this length — the pool only requires a mixed-character password). */
function pick(set: string): string {
  return set[randomBytes(1)[0] % set.length];
}

/**
 * Generates the initial temporary password emailed to a new admin. Meets the
 * Cognito pool policy (upper + lower + digit + symbol, 16 chars) and is forced
 * to change on first sign-in.
 */
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < 16) chars.push(pick(all));
  // Fisher-Yates shuffle so the required characters aren't always leading.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Creates the admin with a freshly allocated sequential id. Retries once when a
 * concurrent create grabbed the same value — the unique `adminId` index is the
 * real guard.
 */
async function createWithGeneratedId(fields: NewAdminFields) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await Admin.create({ ...fields, adminId: await nextAdminId() });
    } catch (err) {
      const duplicateId = (err as { code?: number })?.code === 11000 && attempt === 0;
      if (duplicateId) continue;
      throw err;
    }
  }
  throw conflictError('Could not allocate an admin id. Please retry.');
}

/**
 * Admins — Create
 * Use-case: create an admin account. Only users with the top-tier
 * 'SUPER_ADMIN' assigned role may create administrators.
 * POST /admins (admin, assignedRole = SUPER_ADMIN)
 */
export async function createAdmin(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireAssignedRole(auth, ['SUPER_ADMIN']);

  const body = parseBody(event) as CreateAdminBody;
  const { firstName, lastName, userName, emailAddress, phoneNumber } = body;

  if (!firstName || !lastName || !userName || !emailAddress) {
    return badRequest('firstName, lastName, userName, and emailAddress are required.');
  }

  await connectToDatabase();

  const existing = await Admin.findOne({
    $or: [{ userName }, { emailAddress: emailAddress.toLowerCase() }],
  });
  if (existing) {
    throw conflictError('An admin with this userName or email already exists.');
  }

  // The initial credential is generated here and never accepted from the
  // client: it is hashed into Mongo so offline sign-in still works, and handed
  // to Cognito below, which emails it as the admin's temporary password.
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const admin = await createWithGeneratedId({
    firstName,
    lastName,
    middleName: body.middleName || undefined,
    userName,
    emailAddress: emailAddress.toLowerCase(),
    passwordHash,
    phoneNumber: phoneNumber?.trim() || undefined,
    assignedRole: body.assignedRole || 'OPERATIONS_CLERK',
    accountStatus: body.accountStatus || 'active',
  });

  // Provision the Cognito user. The pool creates it in FORCE_CHANGE_PASSWORD,
  // so the first sign-in returns NEW_PASSWORD_REQUIRED and the admin must set
  // their own password before MFA enrollment continues. When Cognito isn't
  // configured yet (env ids missing), skip rather than fail — run
  // `npm run provision:cognito` once configured.
  //
  // Invitation: prefer our own branded SES email, but never leave a new admin
  // without credentials. If SES is unconfigured we let Cognito invite them from
  // the start, and if our send fails we fall back to Cognito's invitation —
  // important because the Forgot-password flow depends on SES too, so a broken
  // SES would otherwise lock the new admin out completely.
  const useSesInvite = emailReady();
  let inviteDelivery: 'ses' | 'cognito' | 'failed' = 'failed';

  if (cognitoReady()) {
    try {
      const cognito = getCognitoGateway();
      const { sub } = await cognito.provisionUser({
        username: admin.emailAddress,
        password: tempPassword,
        suppressInviteEmail: useSesInvite,
      });
      admin.cognitoSub = sub;
      await admin.save();

      if (!useSesInvite) {
        console.warn('[admins/create] SES_FROM_ADDRESS is not set — Cognito sent the invitation.');
        inviteDelivery = 'cognito';
      } else {
        try {
          await sendAdminInviteEmail({
            to: admin.emailAddress,
            fullName: `${admin.firstName} ${admin.lastName}`.trim(),
            temporaryPassword: tempPassword,
            signInUrl: `${appBaseUrl()}/admin/login`,
          });
          inviteDelivery = 'ses';
        } catch (err) {
          console.error(
            `[admins/create] SES invitation to ${admin.emailAddress} failed (from ${emailFromAddress()}):`,
            (err as Error)?.message || err
          );
          try {
            await getCognitoGateway().resendInvite(admin.emailAddress);
            console.warn('[admins/create] fell back to Cognito\'s invitation message.');
            inviteDelivery = 'cognito';
          } catch (fallbackErr) {
            console.error(
              '[admins/create] Cognito invitation fallback also failed:',
              (fallbackErr as Error)?.message || fallbackErr
            );
          }
        }
      }
    } catch (err) {
      // Roll back the Mongo record so we don't leave an admin that can't sign in
      // while Cognito already holds the pool user. Only provisioning failures
      // reach here — the invite paths above swallow their own errors.
      await admin.deleteOne().catch(() => null);
      throw err;
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn('[admins/create] Cognito not configured — skipped pool provisioning.');
  }

  // `inviteDelivery` tells the super admin where the invitation came from (or
  // that none went out). The temporary password is never returned to the client.
  return created({ ...admin.toPublicJSON(), inviteDelivery }, 'Admin created.');
}

export const handler = withErrorHandling(createAdmin);