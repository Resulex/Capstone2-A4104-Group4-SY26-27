import mongoose from 'mongoose';
import { Barangay } from '../models';
import { badRequestError } from './errors';

/**
 * Purok (barangay sub-area) vocabulary checks.
 *
 * Incident reports carry a `purok` that must name one of the reporting
 * resident's barangay's puroks. A free-text address cannot be checked for
 * containment -- there is no offline way to turn an address string into
 * coordinates -- so the write path takes a value from a closed list instead and
 * validates membership here. That makes the constraint exact and deterministic:
 * no geocoder, no external service, no rate limits.
 *
 * Matching is deliberately forgiving about presentation and strict about
 * identity: case and stray whitespace are ignored ("purok 1" is accepted) but
 * the value is persisted in the barangay's own spelling ("Purok 1"), so the
 * stored vocabulary never drifts.
 */

/** Trim, collapse internal whitespace and fold the case for comparison. */
export function purokKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The barangay's own spelling of `value`, or `undefined` when it names no purok
 * in the list.
 */
export function canonicalPurok(
  value: string,
  puroks: readonly string[]
): string | undefined {
  const key = purokKey(value);
  if (!key) return undefined;
  return puroks.find((purok) => purokKey(purok) === key);
}

/** Drops empty entries so a half-filled document cannot widen the vocabulary. */
function usablePuroks(puroks: readonly string[] | undefined | null): string[] {
  return (puroks ?? []).filter((purok) => typeof purok === 'string' && !!purok.trim());
}

/**
 * The purok vocabulary that applies to a resident, looked up from their own
 * `barangay` reference.
 *
 * Falls back to the oldest active barangay when the reference is missing or
 * unusable: `Resident.barangay` is optional, and this deployment serves a single
 * barangay, so a resident without one must still be able to file. Returns an
 * empty list when nothing resolves, which `assertPurokInBarangay` reports as a
 * configuration problem instead of accepting an unvalidated value.
 *
 * `mongoose.isValidObjectId` guards the lookup: `findById` throws a CastError
 * (a 500) on a malformed id.
 */
export async function resolveBarangayPuroks(
  barangayId?: unknown
): Promise<string[]> {
  if (mongoose.isValidObjectId(barangayId)) {
    const byId = await Barangay.findById(barangayId).select('puroks').lean();
    if (byId) {
      const list = usablePuroks(byId.puroks);
      // A row that predates `puroks` carries an empty list; fall through so the
      // active fallback can still supply the vocabulary.
      if (list.length > 0) return list;
    }
  }

  const fallback = await Barangay.findOne({ isActive: true })
    .sort({ createdAt: 1 })
    .select('puroks')
    .lean();
  return usablePuroks(fallback?.puroks);
}

/**
 * Validates a submitted purok against the barangay's list, returning the
 * canonical spelling to persist.
 *
 * An empty list means the barangay's vocabulary is not available (a row seeded
 * before the field existed, or a migration that has not run). Validating
 * against nothing would reject every value, so that case fails with an
 * actionable message rather than silently accepting the input.
 */
export function assertPurokInBarangay(
  value: unknown,
  puroks: readonly string[] | undefined | null
): string {
  const list = usablePuroks(puroks);

  if (list.length === 0) {
    throw badRequestError(
      'The barangay has no purok list configured, so the incident location cannot be validated. Please contact the barangay office.'
    );
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw badRequestError(
      `purok is required and must be one of: ${list.join(', ')}.`
    );
  }

  const canonical = canonicalPurok(value, list);
  if (!canonical) {
    throw badRequestError(
      `"${value.trim()}" is not a purok in this barangay. Choose one of: ${list.join(', ')}.`
    );
  }

  return canonical;
}
