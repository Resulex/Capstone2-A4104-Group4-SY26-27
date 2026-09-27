import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import mongoose from 'mongoose';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { conflictError, notFoundError } from '../../../shared/errors';
import { Resident } from '../../../models';
import { getAuthContext, requireResident } from '../../../shared/authorization';
import {
  RESIDENT_DELETION_GRACE_DAYS,
  deletionGraceEndsAt,
  deletionStateOf,
  syncResidentDeletion,
} from '../../../shared/resident-deletion';

/**
 * Residents — My Account Deletion (self-service)
 *
 * Use-case: let a resident permanently delete their own account, with a
 * recoverable grace window:
 *   POST   /residents/me/deletion  → request deletion (starts the 30-day clock)
 *   GET    /residents/me/deletion  → read the current deletion state
 *   DELETE /residents/me/deletion  → restore (cancel) while still recoverable
 *
 * All three are resident-only and act on the CALLER's own record. Three path
 * segments on purpose, so `residents/{id}` can never shadow them (the same
 * reasoning as `residents/me/consent`).
 *
 * Scope note: this NEVER touches `Resident.isDeleted` (the admin soft-delete,
 * which hides the row from the Residents list and blocks sign-in). Admin-visible
 * data is retained in full; only the resident's own view of their PRE-EXISTING
 * records is hidden, and only their own writes to those records are blocked.
 */
interface DeletionRequestBody {
  /** Optional free-text reason shown to admins. */
  reason?: string;
}

/** Loads the caller's own Resident document, or fails closed. */
async function loadCallerResident(authUserId: string) {
  // The JWT `sub` is the Resident `_id` for both SSO and self-registered
  // residents. Guard the cast so a non-ObjectId subject (a `User` with no linked
  // `Resident` yet) resolves to "no record" instead of a CastError (500).
  if (!mongoose.isValidObjectId(authUserId)) return null;
  return Resident.findById(authUserId);
}

/** The payload every action returns, so the frontend can re-render in one go. */
function statePayload(resident: Parameters<typeof deletionStateOf>[0]) {
  return {
    ...deletionStateOf(resident),
    graceDays: RESIDENT_DELETION_GRACE_DAYS,
  };
}

/**
 * POST /residents/me/deletion — request permanent deletion.
 *
 * Idempotent: asking twice while a request is pending re-reports the existing
 * schedule rather than pushing the date out (a resident must not be able to
 * extend the window by clicking again).
 */
export async function requestDeletion(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireResident(auth);

  await connectToDatabase();

  const resident = await loadCallerResident(auth.userId);
  if (!resident) {
    throw notFoundError('Resident record not found.');
  }

  if (resident.deletionFinalizedAt) {
    throw conflictError('This account has already been permanently deleted.');
  }

  if (!resident.deletionRequestedAt) {
    // The reason is the only body field, so a body is optional here — unlike
    // the create/update handlers, which `parseBody` rightly forces.
    const body = event.body ? (parseBody(event) as DeletionRequestBody) : {};
    const requestedAt = new Date();
    resident.deletionRequestedAt = requestedAt;
    resident.deletionScheduledFor = deletionGraceEndsAt(requestedAt);
    const reason = body?.reason?.trim();
    resident.deletionReason = reason || undefined;
    await resident.save();
  } else {
    // Already pending — make sure an elapsed window is finalized before replying.
    await syncResidentDeletion(resident);
  }

  return ok(statePayload(resident), 'Account deletion requested.');
}

/** GET /residents/me/deletion — the caller's current deletion state. */
export async function getDeletion(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireResident(auth);

  await connectToDatabase();

  const resident = await loadCallerResident(auth.userId);
  if (!resident) {
    throw notFoundError('Resident record not found.');
  }

  // Lazy finalize: `serverless-offline` never runs the scheduled sweep, so an
  // elapsed window is applied the first time the resident looks at it.
  await syncResidentDeletion(resident);

  return ok(statePayload(resident), 'Deletion state fetched.');
}

/**
 * DELETE /residents/me/deletion — restore the account.
 *
 * Only possible while the request is still pending; once finalized the deletion
 * is permanent and the resident is told so instead of being silently ignored.
 */
export async function cancelDeletion(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireResident(auth);

  await connectToDatabase();

  const resident = await loadCallerResident(auth.userId);
  if (!resident) {
    throw notFoundError('Resident record not found.');
  }

  if (resident.deletionFinalizedAt) {
    throw conflictError(
      'This account has already been permanently deleted and cannot be restored.'
    );
  }

  // Clearing the request date is all it takes: every "is this record frozen?"
  // check is derived from it, so the resident's records become visible and
  // writable again on the next request.
  resident.deletionRequestedAt = undefined;
  resident.deletionScheduledFor = undefined;
  resident.deletionReason = undefined;
  await resident.save();

  return ok(statePayload(resident), 'Account deletion cancelled.');
}

export const requestHandler = withErrorHandling(requestDeletion);
export const getHandler = withErrorHandling(getDeletion);
export const cancelHandler = withErrorHandling(cancelDeletion);
