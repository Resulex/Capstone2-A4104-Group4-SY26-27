import { OAuth2Client } from 'google-auth-library';
import { unauthorizedError } from './errors';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';

// OAuth2Client caches Google's public certs and is safe to reuse across warm
// Lambda invocations.
let oauthClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured.');
  }
  if (!oauthClient) {
    oauthClient = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  }
  return oauthClient;
}

/**
 * Builds the Google OAuth authorization URL for resident SSO.
 * `scope` requests the OIDC claims needed for onboarding (profile + email).
 * `state` is an opaque value the caller persists (e.g. to a cookie) for
 * CSRF protection.
 */
export function buildGoogleAuthUrl(state: string): string {
  return getOAuthClient().generateAuthUrl({
    access_type: 'online',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid',
    ],
    state,
    prompt: 'select_account',
  });
}

/** Exchanges an authorization code for an OAuth token (id_token + access_token). */
export async function exchangeCodeForTokens(
  code: string
): Promise<{ idToken: string }> {
  try {
    const { tokens } = await getOAuthClient().getToken(code);
    if (!tokens.id_token) {
      throw new Error('No id_token returned from Google.');
    }
    return { idToken: tokens.id_token };
  } catch {
    throw unauthorizedError('Failed to exchange the Google authorization code.');
  }
}

export interface GoogleProfile {
  sub: string; // Google account unique identifier
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  picture?: string;
}

/**
 * Verifies the Google ID token. Only tokens signed by Google for our own
 * client id (aud) are accepted — this is what makes SSO trustworthy.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  try {
    const ticket = await getOAuthClient().verifyIdToken({
      idToken,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new Error('ID token payload missing identity claims.');
    }
    // Split the userinfo name into first/last names (best-effort).
    const fullName = payload.name?.trim() ?? '';
    const [first = fullName, ...rest] = fullName.split(/\s+/);
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: Boolean(payload.email_verified),
      firstName: first,
      lastName: rest.join(' ') || first,
      picture: payload.picture,
    };
  } catch {
    throw unauthorizedError('Invalid Google ID token.');
  }
}

/**
 * Verifies a Google ID token for the resident SSO flow without needing a
 * pre-authorized OAuth client (used when we only have the id_token).
 */
export async function verifyGoogleIdTokenStandalone(
  idToken: string
): Promise<GoogleProfile> {
  if (!CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not configured.');
  }
  try {
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new Error('ID token payload missing identity claims.');
    }
    const fullName = payload.name?.trim() ?? '';
    const [first = fullName, ...rest] = fullName.split(/\s+/);
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: Boolean(payload.email_verified),
      firstName: first,
      lastName: rest.join(' ') || first,
      picture: payload.picture,
    };
  } catch {
    throw unauthorizedError('Invalid Google ID token.');
  }
}