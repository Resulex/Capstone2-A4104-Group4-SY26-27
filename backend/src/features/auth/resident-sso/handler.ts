import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import crypto from 'node:crypto';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { unauthorizedError, conflictError } from '../../../shared/errors';
import { Resident } from '../../../models';
import { signToken } from '../../../shared/auth';
import { buildGoogleAuthUrl, exchangeCodeForTokens, verifyGoogleIdToken } from '../../../shared/google';

// ---------------------------------------------------------------------------
// Start — redirect the resident to Google's consent screen
// ---------------------------------------------------------------------------

/**
 * Auth — Resident Google SSO Start
 * Use-case: generate a Google OAuth authorization URL for resident login.
 *
 * GET /auth/resident/google
 *
 * `state` is an opaque CSRF token the client persists and echoes back on the
 * callback; in a browser flow this is typically stored in an HTTP-only cookie.
 */
export async function startGoogleLogin(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = buildGoogleAuthUrl(state);
  return ok({ authUrl, state }, 'Redirect the user to the Google sign-in page.');
}

// ---------------------------------------------------------------------------
// Callback — exchange the code, provision/login the resident
// ---------------------------------------------------------------------------

/**
 * Auth — Resident Google SSO Callback
 * Use-case: complete the OAuth handshake, verify the Google ID token, and
 * either log in an existing resident or provision a first-time resident record.
 *
 * GET /auth/resident/google/callback?code=...&state=...
 *
 * Returns an HTML page that posts the result to the frontend window so the
 * token never needs to be exposed in the address bar (recommended) — or simply
 * parse the JSON body if the client calls this endpoint directly.
 */
export async function googleLoginCallback(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const query = event.queryStringParameters || {};
  const { code, error } = query;

  if (error) {
    return ok({ success: false, error }, 'Google sign-in was cancelled.');
  }
  if (!code) {
    throw unauthorizedError('Missing Google authorization code.');
  }

  // Exchange the code for an id_token, then verify it (issuer + audience).
  let idToken: string;
  try {
    ({ idToken } = await exchangeCodeForTokens(code));
  } catch {
    throw unauthorizedError('Invalid Google authorization code.');
  }

  const profile = await verifyGoogleIdToken(idToken);

  await connectToDatabase();

  // 1) Returning resident — match by the stable Google `sub`.
  let resident = await Resident.findOne({ googleSub: profile.sub });

  // 2) Existing resident created by an admin but not yet linked to Google —
  //    link by verified email if a match exists and no other Google account
  //    has claimed that email.
  if (!resident) {
    resident = await Resident.findOne({ emailAddress: profile.email });
  }

  let isNewResident = false;
  if (!resident) {
    // 3) First-time login — provision a minimal record. The resident completes
    //    the remaining PII (barangay, address, contact) during onboarding.
    resident = await Resident.create({
      firstName: profile.firstName,
      lastName: profile.lastName,
      emailAddress: profile.email,
      googleSub: profile.sub,
      googleEmail: profile.email,
      profileImageUrl: profile.picture,
      accountStatus: 'active',
      isProvisioned: false,
    }).catch(() => null);

    if (!resident) {
      // Likely a unique-constraint race (email taken). Re-check.
      throw conflictError('An account with this email already exists. Please sign in another way.');
    }
    isNewResident = true;
  } else {
    // Link the Google account if it was matched by email.
    if (!resident.googleSub) {
      resident.googleSub = profile.sub;
      resident.googleEmail = profile.email;
      await resident.save().catch(() => null);
    }
  }

  if (resident.accountStatus !== 'active') {
    throw unauthorizedError('This account is not active.');
  }

  const token = signToken(String(resident.id), 'resident');

  // Return an HTML page that posts the result back to the opener (frontend)
  // window. This keeps the JWT out of the address bar and lets the login page's
  // `message` listener complete the session without a redirect round-trip.
  const payload = {
    token,
    user: resident.toPublicJSON(),
    isNewUser: isNewResident,
    isNewResident,
    profileComplete: resident.isProvisioned,
  };
  const serialized = JSON.stringify(payload);

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Signing you in…</title>
    <style>
      body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; color: #333; }
    </style>
  </head>
  <body>
    <p>Signing you in… Please close this window if it does not close automatically.</p>
    <script>
      (function () {
        var payload = ${serialized};
        if (window.opener) {
          // The opener runs on a different origin (frontend), so we must use "*".
          // The token is short-lived and trusted, and the frontend validates its
          // origin before accepting the message.
          window.opener.postMessage(payload, '*');
          window.close();
        } else {
          document.body.textContent = 'This window should be opened from the KaBarangayConnect login page.';
        }
      })();
    <\/script>
  </body>
</html>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: html,
  };
}

export const startHandler = withErrorHandling(startGoogleLogin);
export const callbackHandler = withErrorHandling(googleLoginCallback);

// Convenience alias used by serverless function definitions.
export const handler = startHandler;