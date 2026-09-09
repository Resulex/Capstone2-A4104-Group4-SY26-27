import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDeleteSoftwareTokenCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminSetUserMFAPreferenceCommand,
  AdminSetUserPasswordCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { generateSecret } from 'otplib';
import { connectToDatabase } from '../config/db';
import { Admin } from '../models';
import { comparePassword, hashPassword } from './password';
import {
  AppError,
  badRequestError,
  forbiddenError,
  serverError,
  unauthorizedError,
} from './errors';
import { verifyTotp } from './totp';

/**
 * AWS Cognito helpers for admin authentication (software-token TOTP MFA).
 *
 * This is the seam between the (Mongo-backed) admin RBAC layer and AWS
 * Cognito User Pools. Cognito owns the admin *password + TOTP (Google
 * Authenticator) challenge*; the rest of the app keeps its own HS256 session
 * JWT, so the authorizer, ~90 protected handlers, and the resident flow are
 * untouched.
 *
 * Two implementations behind the same {@link CognitoGateway} interface:
 * - Real (`AwsCognitoGateway`): talks to a live user pool via the admin
 *   IDP API. Used in deployed AWS.
 * - Offline (`OfflineCognitoGateway`): an in-process stub used for local
 *   `serverless offline` development when COGNITO_OFFLINE=true. It verifies
 *   the admin password against the Mongo bcrypt hash and accepts the
 *   documented dev code `123456` (no live pool required).
 *
 * The Lambda itself stays stateless: the Cognito challenge `session` string
 * is round-tripped to the client and back, never stored server-side.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Cognito challenge names relevant to admin MFA (software token = TOTP). */
export type AuthChallengeName = 'SOFTWARE_TOKEN_MFA' | 'MFA_SETUP';

/** Result of {@link CognitoGateway.initiateAuth}. */
export type AuthStartResult =
  | { challenge: 'SOFTWARE_TOKEN_MFA'; session: string }
  | { challenge: 'MFA_SETUP'; session: string };

/** Result of {@link CognitoGateway.respondToTotpChallenge}. */
export interface AuthCompleteResult {
  /** Cognito username (the admin's emailAddress). */
  username: string;
  /** Cognito `sub` claim — stable user identifier in the pool. */
  sub: string;
}

/** Data returned by {@link CognitoGateway.startTotpSetup}. */
export interface TotpSetupResult {
  /** Base32 TOTP secret to render as a QR / manual entry. */
  secretCode: string;
  /** New challenge session to pass to {@link CognitoGateway.completeTotpSetup}. */
  session: string;
}

/** Input for {@link CognitoGateway.provisionUser}. */
export interface ProvisionParams {
  /** Cognito username = the admin's emailAddress. */
  username: string;
  /** Permanent password to set (bypasses NEW_PASSWORD_REQUIRED). */
  password: string;
}

/** Thin abstraction over the Cognito admin IDP API (software-token MFA). */
export interface CognitoGateway {
  /** Start password auth. Throws 401 on invalid credentials. */
  initiateAuth(username: string, password: string): Promise<AuthStartResult>;
  /** Return the pool user's `sub` for a username. */
  getUserSub(username: string): Promise<string>;
  /** Begin TOTP enrollment for an MFA_SETUP session (AssociateSoftwareToken). */
  startTotpSetup(session: string): Promise<TotpSetupResult>;
  /** Finish TOTP enrollment: verify the code, enable the token, return sub. */
  completeTotpSetup(
    username: string,
    session: string,
    code: string
  ): Promise<{ sub: string }>;
  /** Complete sign-in by answering a SOFTWARE_TOKEN_MFA challenge. */
  respondToTotpChallenge(
    username: string,
    session: string,
    code: string
  ): Promise<AuthCompleteResult>;
  /** Create (or update) the pool user. MFA is enforced by the pool itself. */
  provisionUser(params: ProvisionParams): Promise<{ sub: string }>;
  /** Set a new permanent password for the pool user. */
  setPassword(username: string, newPassword: string): Promise<void>;
  /** Request a password-reset code (Cognito emails a 6-digit code). */
  forgotPassword(username: string): Promise<void>;
  /** Confirm a reset code and set a new password. */
  confirmForgotPassword(username: string, code: string, newPassword: string): Promise<void>;
  /** Enable/disable the pool user to mirror `accountStatus` (best effort). */
  setAccountStatus(username: string, accountStatus: string): Promise<void>;
  /** Delete the pool user (no-op if absent). */
  deleteUser(username: string): Promise<void>;
  /** Delete the user's registered software token (no-op if absent/none) so the
   *  next sign-in returns an MFA_SETUP challenge and the admin re-scans a QR. */
  deleteSoftwareToken(username: string): Promise<void>;
}

/** True when running against the offline stub instead of a live pool. */
function isOffline(): boolean {
  const value = process.env.COGNITO_OFFLINE || process.env.IS_OFFLINE || '';
  return value === 'true' || value === '1';
}

export function isCognitoOffline(): boolean {
  return isOffline();
}

/** True when the gateway can reach a live pool (or is the offline stub). */
export function cognitoReady(): boolean {
  if (isOffline()) return true;
  return Boolean(
    process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID
  );
}

// ---------------------------------------------------------------------------
// Real implementation (live AWS Cognito User Pool)
// ---------------------------------------------------------------------------

class AwsCognitoGateway implements CognitoGateway {
  private readonly poolId = process.env.COGNITO_USER_POOL_ID || '';
  private readonly clientId = process.env.COGNITO_CLIENT_ID || '';
  private readonly clientSecret = process.env.COGNITO_CLIENT_SECRET || '';
  private client: CognitoIdentityProviderClient | null = null;

  private assertConfigured(): void {
    if (!this.poolId || !this.clientId) {
      throw serverError(
        'Cognito is not configured (COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID).'
      );
    }
  }

  /** Lazy client (credentials resolve via the Lambda execution role). */
  private getClient(): CognitoIdentityProviderClient {
    this.assertConfigured();
    if (!this.client) {
      const region =
        process.env.COGNITO_REGION ||
        process.env.COGNITO_SMS_REGION || // legacy env name
        process.env.AWS_REGION ||
        'ap-southeast-1';
      this.client = new CognitoIdentityProviderClient({ region });
    }
    return this.client;
  }

  /**
   * SECRET_HASH for clients that have a generated client secret:
   * Base64(HMAC-SHA256(clientSecret, username + clientId)). Undefined when the
   * app client has no secret (then Cognito does not expect a hash).
   */
  private secretHash(username: string): string | undefined {
    if (!this.clientSecret) return undefined;
    return createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }

  /** Map known SDK auth failures to a generic 401 (no user enumeration). */
  private mapAuthError(err: unknown): never {
    const name = (err as { name?: string })?.name || '';
    if (
      [
        'NotAuthorizedException',
        'UserNotFoundException',
        'UserNotConfirmedException',
        'PasswordResetRequiredException',
      ].includes(name)
    ) {
      throw unauthorizedError('Invalid credentials.');
    }
    console.error('[cognito] auth error:', (err as Error)?.message || err);
    throw serverError('Authentication service error.');
  }

  private async isUserNotFound(err: unknown): Promise<boolean> {
    return (err as { name?: string })?.name === 'UserNotFoundException';
  }

  async getUserSub(username: string): Promise<string> {
    try {
      const res = await this.getClient().send(
        new AdminGetUserCommand({ UserPoolId: this.poolId, Username: username })
      );
      const sub = res.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
      if (!sub) {
        throw serverError('Cognito user is missing the sub attribute.');
      }
      return sub;
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error('[cognito] getUserSub error:', (err as Error)?.message || err);
      throw serverError('Authentication service error.');
    }
  }

  async initiateAuth(username: string, password: string): Promise<AuthStartResult> {
    try {
      const res = await this.getClient().send(
        new AdminInitiateAuthCommand({
          UserPoolId: this.poolId,
          ClientId: this.clientId,
          AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
            ...(this.secretHash(username)
              ? { SECRET_HASH: this.secretHash(username) as string }
              : {}),
          },
        })
      );

      // Enrolled → return the challenge so the client can ask for the code.
      if (res.ChallengeName === 'SOFTWARE_TOKEN_MFA' && res.Session) {
        return { challenge: 'SOFTWARE_TOKEN_MFA', session: res.Session };
      }

      // Not enrolled yet → return the session so the client can run the
      // TOTP setup (AssociateSoftwareToken / VerifySoftwareToken) steps.
      if (res.ChallengeName === 'MFA_SETUP' && res.Session) {
        return { challenge: 'MFA_SETUP', session: res.Session };
      }

      // Fail closed: with MFA enforced, a successful password check ALWAYS
      // returns SOFTWARE_TOKEN_MFA (enrolled) or MFA_SETUP (not enrolled). If
      // a bare AuthenticationResult arrives, the user pool is not enforcing
      // MFA — never sign the admin in without a 6-digit code.
      if (res.AuthenticationResult) {
        throw forbiddenError(
          'Two-factor authentication is not enabled for this account. Please contact an administrator.'
        );
      }

      if (res.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        throw badRequestError(
          'A password change is required for this account. Ask an administrator to re-provision it.'
        );
      }
      throw serverError(
        `Unexpected Cognito challenge: ${res.ChallengeName || 'none'}.`
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      this.mapAuthError(err);
    }
  }

  async respondToTotpChallenge(
    username: string,
    session: string,
    code: string
  ): Promise<AuthCompleteResult> {
    try {
      const res = await this.getClient().send(
        new AdminRespondToAuthChallengeCommand({
          UserPoolId: this.poolId,
          ClientId: this.clientId,
          ChallengeName: 'SOFTWARE_TOKEN_MFA',
          Session: session,
          ChallengeResponses: {
            USERNAME: username,
            SOFTWARE_TOKEN_MFA_CODE: code,
            ...(this.secretHash(username)
              ? { SECRET_HASH: this.secretHash(username) as string }
              : {}),
          },
        })
      );
      if (!res.AuthenticationResult) {
        throw serverError('Unexpected authentication state after MFA.');
      }
      const sub = await this.getUserSub(username);
      return { username, sub };
    } catch (err) {
      if (err instanceof AppError) throw err;
      const name = (err as { name?: string })?.name || '';
      if (
        [
          'CodeMismatchException',
          'ExpiredCodeException',
          'InvalidSessionException',
          'NotAuthorizedException',
          'UserNotFoundException',
        ].includes(name)
      ) {
        throw unauthorizedError('Invalid or expired verification code.');
      }
      console.error('[cognito] challenge error:', (err as Error)?.message || err);
      throw serverError('Authentication service error.');
    }
  }

  async startTotpSetup(session: string): Promise<TotpSetupResult> {
    try {
      // Session-scoped (not an admin API): the MFA_SETUP session authorizes
      // associating a new software token to the admin.
      const res = await this.getClient().send(
        new AssociateSoftwareTokenCommand({ Session: session })
      );
      if (!res.SecretCode) {
        throw serverError('Cognito did not return a TOTP secret.');
      }
      return { secretCode: res.SecretCode, session: res.Session ?? session };
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error('[cognito] associate token error:', (err as Error)?.message || err);
      throw serverError('Failed to start authenticator setup.');
    }
  }

  async completeTotpSetup(
    username: string,
    session: string,
    code: string
  ): Promise<{ sub: string }> {
    try {
      const res = await this.getClient().send(
        new VerifySoftwareTokenCommand({ Session: session, UserCode: code })
      );
      if (res.Status !== 'SUCCESS') {
        throw unauthorizedError('Invalid or expired verification code.');
      }
      // Mark software-token MFA as enabled + preferred for this admin so the
      // next sign-in returns a SOFTWARE_TOKEN_MFA challenge.
      await this.getClient().send(
        new AdminSetUserMFAPreferenceCommand({
          UserPoolId: this.poolId,
          Username: username,
          SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
        })
      );
      // Mirror enrollment state in Mongo (best effort, never fails the flow)
      // so the Admin profile and offline dev reflect reality.
      try {
        await connectToDatabase();
        await Admin.updateOne(
          { emailAddress: username.toLowerCase() },
          { $set: { mfaEnrolled: true } }
        );
      } catch {
        // best effort — enrollment already succeeded in Cognito
      }
      return { sub: await this.getUserSub(username) };
    } catch (err) {
      if (err instanceof AppError) throw err;
      const name = (err as { name?: string })?.name || '';
      if (['CodeMismatchException', 'NotAuthorizedException'].includes(name)) {
        throw unauthorizedError('Invalid or expired verification code.');
      }
      console.error('[cognito] verify token error:', (err as Error)?.message || err);
      throw serverError('Failed to complete authenticator setup.');
    }
  }

  async provisionUser(params: ProvisionParams): Promise<{ sub: string }> {
    const { username, password } = params;
    try {
      let exists = true;
      try {
        await this.getClient().send(
          new AdminGetUserCommand({ UserPoolId: this.poolId, Username: username })
        );
      } catch (err) {
        if (await this.isUserNotFound(err)) {
          exists = false;
        } else {
          throw err;
        }
      }

      if (!exists) {
        await this.getClient().send(
          new AdminCreateUserCommand({
            UserPoolId: this.poolId,
            Username: username,
            UserAttributes: [
              { Name: 'email', Value: username },
              { Name: 'email_verified', Value: 'true' },
            ],
            // Never let Cognito email a temp password — we set it ourselves
            // right below (and print/record it in the provisioning script).
            MessageAction: 'SUPPRESS',
          })
        );
      }

      // Permanent password → CONFIRMED user, so no NEW_PASSWORD_REQUIRED.
      // MFA itself is enforced by the pool (MfaConfiguration ON): on first
      // sign-in Cognito returns MFA_SETUP so the admin scans a QR code.
      await this.getClient().send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.poolId,
          Username: username,
          Password: password,
          Permanent: true,
        })
      );

      return { sub: await this.getUserSub(username) };
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error('[cognito] provision error:', (err as Error)?.message || err);
      throw serverError('Failed to provision the Cognito user.');
    }
  }

  async setAccountStatus(username: string, accountStatus: string): Promise<void> {
    try {
      if (accountStatus === 'active') {
        await this.getClient().send(
          new AdminEnableUserCommand({ UserPoolId: this.poolId, Username: username })
        );
      } else {
        await this.getClient().send(
          new AdminDisableUserCommand({ UserPoolId: this.poolId, Username: username })
        );
      }
    } catch (err) {
      if (await this.isUserNotFound(err)) return; // not provisioned yet
      console.error('[cognito] setAccountStatus error:', (err as Error)?.message || err);
      throw serverError('Failed to sync the account status to Cognito.');
    }
  }

  async deleteUser(username: string): Promise<void> {
    try {
      await this.getClient().send(
        new AdminDeleteUserCommand({ UserPoolId: this.poolId, Username: username })
      );
    } catch (err) {
      if (await this.isUserNotFound(err)) return; // already gone
      console.error('[cognito] deleteUser error:', (err as Error)?.message || err);
      throw serverError('Failed to delete the Cognito user.');
    }
  }

  async deleteSoftwareToken(username: string): Promise<void> {
    try {
      await this.getClient().send(
        new AdminDeleteSoftwareTokenCommand({
          UserPoolId: this.poolId,
          Username: username,
        })
      );
    } catch (err) {
      // Recovery reset is idempotent: nothing to reset when the user is gone,
      // or no software token is associated. Cognito reports a missing token as
      // ResourceNotFoundException ("Software token MFA has not been configured
      // for this user") — some migrated admins never completed a QR enrollment.
      // Any other failure surfaces as a 500.
      if (await this.isUserNotFound(err)) return;
      const name = (err as { name?: string })?.name || '';
      if (
        name === 'SoftwareTokenMFANotFoundException' ||
        name === 'ResourceNotFoundException' ||
        name === 'InvalidParameterException'
      ) {
        // No token associated — nothing to delete (already un-enrolled).
        return;
      }
      console.error('[cognito] deleteSoftwareToken error:', (err as Error)?.message || err);
      throw serverError('Failed to reset the authenticator for the Cognito user.');
    }
  }

  async setPassword(username: string, newPassword: string): Promise<void> {
    try {
      await this.getClient().send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.poolId,
          Username: username,
          Password: newPassword,
          Permanent: true,
        })
      );
    } catch (err) {
      if (await this.isUserNotFound(err)) return; // not provisioned yet
      console.error('[cognito] setPassword error:', (err as Error)?.message || err);
      throw serverError('Failed to update the Cognito password.');
    }
  }

  async forgotPassword(username: string): Promise<void> {
    this.assertConfigured();
    try {
      await this.getClient().send(
        new ForgotPasswordCommand({
          ClientId: this.clientId,
          Username: username,
          SecretHash: this.secretHash(username),
        })
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Avoid user enumeration: treat unknown users as a no-op success.
      if ((err as { name?: string })?.name === 'UserNotFoundException') return;
      console.error('[cognito] forgotPassword error:', (err as Error)?.message || err);
      throw serverError('Failed to request a password reset.');
    }
  }

  async confirmForgotPassword(username: string, code: string, newPassword: string): Promise<void> {
    this.assertConfigured();
    try {
      await this.getClient().send(
        new ConfirmForgotPasswordCommand({
          ClientId: this.clientId,
          Username: username,
          ConfirmationCode: code,
          Password: newPassword,
          SecretHash: this.secretHash(username),
        })
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      const name = (err as { name?: string })?.name || '';
      if (
        ['CodeMismatchException', 'ExpiredCodeException', 'InvalidPasswordException', 'UserNotFoundException'].includes(
          name
        )
      ) {
        throw badRequestError('Invalid verification code or password.');
      }
      console.error('[cognito] confirmForgotPassword error:', (err as Error)?.message || err);
      throw serverError('Failed to reset the password.');
    }
  }
}

// ---------------------------------------------------------------------------
// Offline stub (local `serverless offline`, no live Cognito pool)
// ---------------------------------------------------------------------------

/**
 * In-process stand-in for Cognito. Passwords are verified against the Mongo
 * `Admin.passwordHash` (kept solely for local dev). Enrollment mirrors the
 * real pool via the Admin `mfaEnrolled` flag:
 * - Not enrolled → MFA_SETUP challenge with a REAL random base32 secret, so
 *   the QR code is genuinely scannable by Google Authenticator. Real TOTP
 *   codes (or the dev code below) complete enrollment.
 * - Enrolled → SOFTWARE_TOKEN_MFA challenge completed by the dev code below.
 * The dev code is logged so it shows in the `serverless offline` terminal.
 *
 * Sessions are STATELESS signed tokens (NOT an in-memory map): serverless
 * offline bundles each function separately, so module-level state written by
 * POST /login would be invisible to POST /login/mfa or /totp/verify. A token
 * embeds { username, kind, exp, secret? } plus an HMAC-SHA256 tag derived from
 * a fixed dev secret compiled into every bundle, so multi-step MFA flows work
 * across functions. Tokens are only trusted when the HMAC verifies.
 */

/** Payload embedded in a signed offline MFA session token. */
interface OfflineSessionPayload {
  username: string;
  /** `challenge` = SOFTWARE_TOKEN_MFA (dev code); `setup` = MFA_SETUP QR. */
  kind: 'challenge' | 'setup';
  /** Epoch ms after which the token is invalid. */
  exp: number;
  /** Base32 TOTP secret for `setup` tokens (filled by startTotpSetup). */
  secret?: string;
}

/** Fixed dev-only key compiled into every bundle (offline stub only). */
const OFFLINE_SESSION_SECRET = 'kbc-offline-dev-session-v1';

/** Sign an offline session payload into a self-contained token string. */
function signOfflineSession(payload: OfflineSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const tag = createHmac('sha256', OFFLINE_SESSION_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${tag}`;
}

/** Decode `session` when its signature is valid and it is not expired. */
function parseOfflineSession(
  session: string
): OfflineSessionPayload | undefined {
  const dot = session.indexOf('.');
  if (dot <= 0) return undefined;
  const body = session.slice(0, dot);
  const tag = session.slice(dot + 1);
  const expected = createHmac('sha256', OFFLINE_SESSION_SECRET)
    .update(body)
    .digest('base64url');
  const a = Buffer.from(tag);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
  let payload: OfflineSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
  if (typeof payload?.username !== 'string' || !payload.exp) return undefined;
  if (Date.now() > payload.exp) return undefined;
  return payload;
}

class OfflineCognitoGateway implements CognitoGateway {
  private static readonly DEV_CODE = '123456';
  private static readonly SESSION_TTL_MS = 10 * 60 * 1000;

  private async findAdminByEmail(username: string) {
    await connectToDatabase();
    return Admin.findOne({ emailAddress: username.toLowerCase() }).select(
      '+passwordHash'
    );
  }

  /** Sign a fresh offline session token for `username`. */
  private issueSession(
    username: string,
    kind: OfflineSessionPayload['kind'],
    secret?: string
  ): string {
    return signOfflineSession({
      username: username.toLowerCase(),
      kind,
      exp: Date.now() + OfflineCognitoGateway.SESSION_TTL_MS,
      ...(secret ? { secret } : {}),
    });
  }

  /** True when `code` satisfies the payload: dev code, or a real TOTP code
   *  generated from the token's QR secret (setup tokens only). */
  private async codeIsValid(
    payload: OfflineSessionPayload,
    code: string
  ): Promise<boolean> {
    if (code === OfflineCognitoGateway.DEV_CODE) return true;
    if (payload.kind !== 'setup' || !payload.secret) return false;
    return verifyTotp(code, payload.secret);
  }

  async initiateAuth(username: string, password: string): Promise<AuthStartResult> {
    const admin = await this.findAdminByEmail(username);
    if (!admin || !admin.passwordHash) {
      throw unauthorizedError('Invalid credentials.');
    }
    const passwordMatches = await comparePassword(password, admin.passwordHash);
    if (!passwordMatches) {
      throw unauthorizedError('Invalid credentials.');
    }
    // Offline: enrolled admins get a code challenge; everyone else is pushed
    // through the QR enrollment (MFA_SETUP) so the setup step is testable
    // without a live pool.
    if (admin.mfaEnrolled) {
      // eslint-disable-next-line no-console
      console.warn(
        `[cognito:offline] TOTP dev code for ${admin.emailAddress}: ${OfflineCognitoGateway.DEV_CODE}`
      );
      return {
        challenge: 'SOFTWARE_TOKEN_MFA',
        session: this.issueSession(admin.emailAddress, 'challenge'),
      };
    }
    return {
      challenge: 'MFA_SETUP',
      session: this.issueSession(admin.emailAddress, 'setup'),
    };
  }

  async getUserSub(username: string): Promise<string> {
    const admin = await Admin.findOne({ emailAddress: username.toLowerCase() });
    return admin?.cognitoSub || username;
  }

  async startTotpSetup(session: string): Promise<TotpSetupResult> {
    const payload = parseOfflineSession(session);
    if (!payload || payload.kind !== 'setup') {
      throw unauthorizedError('Invalid or expired session.');
    }
    // Real random base32 secret → the QR code is genuinely scannable with a
    // Google Authenticator-style app. The dev code is also accepted.
    const secret = generateSecret();
    // Re-issue the token so it now carries the secret the admin is scanning.
    const nextSession = this.issueSession(payload.username, 'setup', secret);
    // eslint-disable-next-line no-console
    console.warn(
      `[cognito:offline] TOTP enrollment for ${payload.username} — manual key ${secret} (dev code ${OfflineCognitoGateway.DEV_CODE} also works)`
    );
    return { secretCode: secret, session: nextSession };
  }

  async completeTotpSetup(
    username: string,
    session: string,
    code: string
  ): Promise<{ sub: string }> {
    const payload = parseOfflineSession(session);
    if (
      !payload ||
      payload.kind !== 'setup' ||
      payload.username !== username.toLowerCase() ||
      !(await this.codeIsValid(payload, code))
    ) {
      throw unauthorizedError('Invalid or expired verification code.');
    }
    const admin = await Admin.findOne({ emailAddress: username.toLowerCase() });
    // Mark enrolled so the next sign-in returns a SOFTWARE_TOKEN_MFA challenge.
    if (admin && !admin.mfaEnrolled) {
      admin.mfaEnrolled = true;
      await admin.save().catch(() => null);
    }
    return { sub: admin?.cognitoSub || username };
  }

  async respondToTotpChallenge(
    username: string,
    session: string,
    code: string
  ): Promise<AuthCompleteResult> {
    const payload = parseOfflineSession(session);
    if (
      !payload ||
      payload.kind !== 'challenge' ||
      payload.username !== username.toLowerCase() ||
      !(await this.codeIsValid(payload, code))
    ) {
      throw unauthorizedError('Invalid or expired verification code.');
    }
    const admin = await Admin.findOne({ emailAddress: username.toLowerCase() });
    return { username, sub: admin?.cognitoSub || username };
  }

  async provisionUser(params: ProvisionParams): Promise<{ sub: string }> {
    // Offline: Mongo is the source of truth; there is no separate pool user.
    return { sub: params.username };
  }

  async setAccountStatus(): Promise<void> {
    // Offline: account status is enforced by the Mongo Admin lookup.
  }

  async deleteUser(): Promise<void> {
    // Offline: nothing to delete.
  }

  async deleteSoftwareToken(username: string): Promise<void> {
    // Offline: clear the enrollment mirror so the next offline sign-in returns
    // MFA_SETUP (QR), matching the real-pool reset. The reset script refuses to
    // run offline, but local runs/tests can exercise this.
    const admin = await Admin.findOne({ emailAddress: username.toLowerCase() });
    if (admin?.mfaEnrolled) {
      admin.mfaEnrolled = false;
      await admin.save().catch(() => null);
    }
  }

  async setPassword(): Promise<void> {
    // Offline: the handler persists the new bcrypt hash in Mongo directly,
    // so there is nothing extra to sync here.
  }

  async forgotPassword(username: string): Promise<void> {
    // Offline: no email — log the dev code so the reset flow is testable.
    const admin = await Admin.findOne({ emailAddress: username.toLowerCase() });
    if (!admin) return; // avoid user enumeration
    // eslint-disable-next-line no-console
    console.warn(
      `[cognito:offline] Password reset dev code for ${username}: ${OfflineCognitoGateway.DEV_CODE}`
    );
  }

  async confirmForgotPassword(username: string, code: string, newPassword: string): Promise<void> {
    if (code !== OfflineCognitoGateway.DEV_CODE) {
      throw badRequestError('Invalid verification code.');
    }
    const admin = await Admin.findOne({ emailAddress: username.toLowerCase() });
    if (!admin) throw unauthorizedError('Invalid credentials.');
    admin.passwordHash = await hashPassword(newPassword);
    await admin.save();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let gateway: CognitoGateway | null = null;

/** Returns the shared Cognito gateway (offline stub vs. live pool). */
export function getCognitoGateway(): CognitoGateway {
  if (!gateway) {
    gateway = isOffline() ? new OfflineCognitoGateway() : new AwsCognitoGateway();
  }
  return gateway;
}
