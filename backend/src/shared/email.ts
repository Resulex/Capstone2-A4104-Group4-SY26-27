import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

/**
 * Transactional email via Amazon SES.
 *
 * Used by the admin password-reset flow
 * (`src/features/auth/admin-forgot/handler.ts`). The project reads
 * `process.env` directly rather than through a config module — these variables
 * are declared in `serverless.yml` under `provider.environment`.
 *
 * Two SES facts worth remembering when this silently fails:
 * - Identities are REGIONAL: `SES_FROM_ADDRESS` must be verified in
 *   `SES_REGION`, which must be the region the Lambda runs in.
 * - In the SES sandbox, mail is only delivered to VERIFIED recipient
 *   addresses. Request production access before real staff can be reached.
 */

/** Verified SES identity the mail comes from. */
const fromAddress = process.env.SES_FROM_ADDRESS || '';

/** SES is regional — default to the AWS region the function runs in. */
const region = process.env.SES_REGION || process.env.AWS_REGION || 'ap-southeast-1';

let client: SESClient | null = null;

function getClient(): SESClient {
  if (!client) {
    client = new SESClient({ region });
  }
  return client;
}

/** True when outbound email is configured (a From identity is set). */
export function emailReady(): boolean {
  return Boolean(fromAddress);
}

/** The address mail is sent from, for logging. */
export function emailFromAddress(): string {
  return fromAddress;
}

/**
 * Frontend origin used to build links in outbound email. Defaults to the local
 * dev server — set `APP_BASE_URL` to the deployed frontend everywhere else, or
 * emailed links will point at localhost.
 */
export function appBaseUrl(): string {
  return process.env.APP_BASE_URL || 'http://localhost:8000';
}

export interface PasswordResetEmail {
  /** Recipient — the admin's `emailAddress`. */
  to: string;
  /** Absolute URL the admin clicks to choose a new password. */
  resetUrl: string;
  /** Minutes the link stays valid; quoted in the copy. */
  expiresInMinutes: number;
}

/**
 * Send the admin password-reset link.
 *
 * Throws when SES rejects the send. The forgot-password handler deliberately
 * catches that and still returns its generic response (no user enumeration),
 * so failures are surfaced only in the logs — see the `[admin-forgot]` lines.
 */
export async function sendPasswordResetEmail({
  to,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmail): Promise<void> {
  const subject = 'Reset your KaBarangayConnect admin password';
  // Attribute-safe copy for the href (URLSearchParams already percent-encodes
  // the values, but the `&` separators must be escaped in HTML).
  const href = resetUrl.replace(/&/g, '&amp;');

  const text = [
    'We received a request to reset the password for your KaBarangayConnect admin account.',
    '',
    `Open this link to choose a new password (valid for ${expiresInMinutes} minutes):`,
    resetUrl,
    '',
    'If you did not request this, you can ignore this email — your password will not change.',
    '',
    'KaBarangayConnect',
  ].join('\n');

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">',
    '<h2 style="margin:0 0 16px;font-size:20px;">KaBarangayConnect</h2>',
    '<p style="margin:0 0 16px;line-height:1.5;">We received a request to reset the password for your KaBarangayConnect admin account.</p>',
    '<p style="margin:0 0 24px;">',
    `<a href="${href}" style="display:inline-block;padding:12px 24px;background:#0b3d91;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Choose a new password</a>`,
    '</p>',
    `<p style="margin:0 0 8px;line-height:1.5;color:#555555;font-size:14px;">This link is valid for ${expiresInMinutes} minutes and can be used once.</p>`,
    '<p style="margin:0 0 8px;line-height:1.5;color:#555555;font-size:14px;">If you did not request this, you can ignore this email — your password will not change.</p>',
    '<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />',
    '<p style="margin:0;color:#888888;font-size:12px;">KaBarangayConnect — Barangay Information and Services Portal</p>',
    '</div>',
  ].join('');

  await getClient().send(
    new SendEmailCommand({
      Source: fromAddress,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: text, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    })
  );
}

export interface AdminInviteEmail {
  /** Recipient — the new admin's `emailAddress`. */
  to: string;
  /** Used in the greeting, e.g. "Maria Reyes". */
  fullName: string;
  /** The temporary password the admin must replace on first sign-in. */
  temporaryPassword: string;
  /** Absolute URL of the admin sign-in page. */
  signInUrl: string;
}

/**
 * Send a newly created admin their temporary password.
 *
 * `POST /admins` suppresses Cognito's own invitation so this is the only
 * message sent, and the pool still leaves the user in FORCE_CHANGE_PASSWORD.
 * The forced password change therefore comes from Cognito, not from this email.
 */
export async function sendAdminInviteEmail({
  to,
  fullName,
  temporaryPassword,
  signInUrl,
}: AdminInviteEmail): Promise<void> {
  const subject = 'Your KaBarangayConnect admin account';
  const greeting = fullName ? `Hello ${fullName},` : 'Hello,';

  const text = [
    greeting,
    '',
    'An administrator account has been created for you on KaBarangayConnect.',
    '',
    `Sign in:            ${signInUrl}`,
    `Email:              ${to}`,
    `Temporary password: ${temporaryPassword}`,
    '',
    'The first time you sign in you will choose your own password, then register',
    'an authenticator app (e.g. Google Authenticator) for two-factor verification.',
    'The temporary password above stops working after 7 days.',
    '',
    'If you were not expecting this, please contact your barangay administrator.',
    '',
    'KaBarangayConnect',
  ].join('\n');

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">',
    '<h2 style="margin:0 0 16px;font-size:20px;">KaBarangayConnect</h2>',
    `<p style="margin:0 0 16px;line-height:1.5;">${greeting}</p>`,
    '<p style="margin:0 0 16px;line-height:1.5;">An administrator account has been created for you. Use the details below to sign in.</p>',
    '<table style="margin:0 0 24px;border-collapse:collapse;font-size:14px;">',
    `<tr><td style="padding:4px 12px 4px 0;color:#555555;">Email</td><td style="padding:4px 0;font-weight:600;">${to}</td></tr>`,
    `<tr><td style="padding:4px 12px 4px 0;color:#555555;">Temporary password</td><td style="padding:4px 0;"><code style="background:#f2f2f2;padding:4px 8px;border-radius:4px;font-size:14px;">${temporaryPassword}</code></td></tr>`,
    '</table>',
    '<p style="margin:0 0 24px;">',
    `<a href="${signInUrl}" style="display:inline-block;padding:12px 24px;background:#0b3d91;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Sign in</a>`,
    '</p>',
    '<p style="margin:0 0 8px;line-height:1.5;color:#555555;font-size:14px;">The first time you sign in you will choose your own password, then register an authenticator app (e.g. Google Authenticator) for two-factor verification.</p>',
    '<p style="margin:0 0 8px;line-height:1.5;color:#555555;font-size:14px;">The temporary password stops working after 7 days. If you were not expecting this, please contact your barangay administrator.</p>',
    '<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />',
    '<p style="margin:0;color:#888888;font-size:12px;">KaBarangayConnect — Barangay Information and Services Portal</p>',
    '</div>',
  ].join('');

  await getClient().send(
    new SendEmailCommand({
      Source: fromAddress,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: text, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    })
  );
}
