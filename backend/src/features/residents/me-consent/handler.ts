import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import mongoose from 'mongoose';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Resident } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Residents — My Consent
 * Use-case: report the caller's own Terms + Data Privacy consent as recorded
 * server-side, so the frontend can enforce the portal gate from trusted state
 * instead of a client-cached profile.
 *
 * GET /residents/me/consent (authenticated)
 *
 * Deliberately not routed through `GET /residents/{id}`: that handler checks
 * ownership against `resident.residentId`, which is unset for Google-SSO
 * residents created by the upsert (their `_id` is the JWT `sub`).
 */
export async function getMyConsent(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);

  await connectToDatabase();

  // The JWT `sub` is the Resident `_id` for both SSO and self-registered
  // residents. Guard the cast so a non-ObjectId subject resolves to "no
  // record" instead of throwing a CastError (500).
  const resident = mongoose.isValidObjectId(auth.userId)
    ? await Resident.findById(auth.userId)
    : null;

  if (!resident) {
    // Fail closed: without a residency record consent cannot be proven.
    return ok(
      { termsAccepted: false, termsAcceptedAt: null, termsVersion: null },
      'No residency record for this account.'
    );
  }

  return ok(
    {
      termsAccepted: Boolean(resident.termsAcceptedAt),
      termsAcceptedAt: resident.termsAcceptedAt
        ? resident.termsAcceptedAt.toISOString()
        : null,
      termsVersion: resident.termsVersion ?? null,
    },
    'Consent fetched.'
  );
}

export const handler = withErrorHandling(getMyConsent);
