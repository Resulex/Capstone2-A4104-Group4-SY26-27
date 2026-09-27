import mongoose from 'mongoose';
// Imported from the model module rather than the `models` barrel: the grace
// window constant is not a model, so it is not part of that barrel's contract.
import {
  Resident,
  RESIDENT_DELETION_GRACE_DAYS,
  type IResident,
} from '../models/resident.model';

/**
 * Resident-initiated account deletion.
 *
 * This is a SECOND, independent concept from the admin soft-delete
 * (`Resident.isDeleted`), which hides the row from the Residents list and blocks
 * sign-in. A resident-requested deletion deliberately:
 *   - keeps the resident signed in,
 *   - keeps the row (and every record) visible to admins forever,
 *   - hides and locks the resident's PRE-EXISTING records from their own portal.
 *
 * "Pre-existing" is derived, not stamped per record: a record belongs to the
 * deleted era while `record.createdAt <= resident.deletionRequestedAt`. That
 * keeps restore a single-document update and leaves no orphan flags behind, at
 * the cost of records created *during* the grace window staying visible.
 */
export { RESIDENT_DELETION_GRACE_DAYS };

/** ISO-string view of a resident's deletion state, as sent to the frontend. */
export interface ResidentDeletionState {
  deletionRequestedAt: string | null;
  deletionScheduledFor: string | null;
  deletionFinalizedAt: string | null;
  deletionReason: string | null;
}

/** The moment a deletion requested at `from` stops being recoverable. */
export function deletionGraceEndsAt(from: Date): Date {
  return new Date(
    from.getTime() + RESIDENT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000
  );
}

/**
 * Lazily finalize a deletion whose grace window has elapsed.
 *
 * There is a daily EventBridge sweep for this (`features/residents/deletion-sweep`),
 * but `serverless-offline` does not execute `schedule` events, so the resident
 * session check calls this too. Returns true when the record was finalized.
 */
export async function syncResidentDeletion(resident: IResident): Promise<boolean> {
  if (!resident.deletionRequestedAt || resident.deletionFinalizedAt) return false;

  const dueAt =
    resident.deletionScheduledFor ??
    deletionGraceEndsAt(resident.deletionRequestedAt);

  if (dueAt.getTime() > Date.now()) return false;

  resident.deletionFinalizedAt = new Date();
  await resident.save();
  return true;
}

/** Serializes the deletion fields for the frontend (nulls, never undefined). */
export function deletionStateOf(
  resident: Pick<
    IResident,
    | 'deletionRequestedAt'
    | 'deletionScheduledFor'
    | 'deletionFinalizedAt'
    | 'deletionReason'
  > | null
): ResidentDeletionState {
  return {
    deletionRequestedAt: resident?.deletionRequestedAt
      ? resident.deletionRequestedAt.toISOString()
      : null,
    deletionScheduledFor: resident?.deletionScheduledFor
      ? resident.deletionScheduledFor.toISOString()
      : null,
    deletionFinalizedAt: resident?.deletionFinalizedAt
      ? resident.deletionFinalizedAt.toISOString()
      : null,
    deletionReason: resident?.deletionReason ?? null,
  };
}

/**
 * Whether a record predates the resident's deletion request, i.e. whether it is
 * hidden from them and locked against their writes.
 *
 * Only the RESIDENT's own view is affected — admins and officials keep full
 * access to the record (a request stuck at "Processing" must still be releasable).
 */
export async function isResidentRecordFrozen(
  residentId: string | null | undefined,
  recordCreatedAt: Date | string | null | undefined
): Promise<boolean> {
  if (!residentId) return false;
  const cutoff = await residentDeletionRequestedAt(residentId);
  if (!cutoff) return false;
  if (!recordCreatedAt) return false;
  return new Date(recordCreatedAt).getTime() <= cutoff.getTime();
}

/** The resident's `deletionRequestedAt` (null when they have no pending request). */
export async function residentDeletionRequestedAt(
  residentId: string
): Promise<Date | null> {
  // Guard the cast: a non-ObjectId subject (an account with no linked Resident)
  // must read as "not deleted" instead of throwing a CastError (500).
  if (!mongoose.isValidObjectId(residentId)) return null;
  const resident = await Resident.findById(residentId)
    .select('deletionRequestedAt')
    .lean<{ deletionRequestedAt?: Date } | null>();
  return resident?.deletionRequestedAt ?? null;
}
