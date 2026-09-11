import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import mongoose from 'mongoose';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { getAuthContext } from '../../../shared/authorization';
import { Resident } from '../../../models';

/**
 * Auth — Session
 * Use-case: prove that the caller's session JWT is still valid and report the
 * authoritative role + consent state the frontend needs to render a shell.
 *
 * GET /auth/session  (protected by the auth-jwt authorizer)
 *
 * Why this exists instead of the frontend decoding the cookie itself: the
 * frontend used to base64-decode the `role` claim without verifying anything,
 * so an expired or hand-edited `kbc_token` still reported "authenticated".
 * The authorizer attached to this route runs `verifyToken()` first (HS256
 * signature + `exp`), which is the only trustworthy check. A rejected token
 * never reaches this handler — API Gateway answers 403 (Deny policy) or 401.
 *
 * `role` is returned verbatim ('resident' | 'official' | 'admin') so the client
 * never has to guess between roles.
 */
export async function getSession(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);

  await connectToDatabase();

  // Consent is resident-only state; the JWT `sub` is the Resident `_id` for
  // both Google-SSO and self-registered residents. Guard the cast so a
  // non-ObjectId subject resolves to "no record" instead of a CastError (500).
  //
  // A missing residency record is NOT an auth failure: accounts created via
  // `POST /users` have a `User` but no linked `Resident` until they first
  // create a record (`ensureResidentForUser`). Failing closed to `null`
  // consent sends those residents through `/legal`, matching the existing
  // gate behaviour without logging them out.
  let termsAcceptedAt: string | null = null;
  if (auth.role === 'resident' && mongoose.isValidObjectId(auth.userId)) {
    const resident = await Resident.findById(auth.userId).select('termsAcceptedAt');
    termsAcceptedAt = resident?.termsAcceptedAt
      ? resident.termsAcceptedAt.toISOString()
      : null;
  }

  return ok(
    {
      role: auth.role,
      userId: auth.userId,
      termsAcceptedAt,
    },
    'Session verified.'
  );
}

export const handler = withErrorHandling(getSession);
