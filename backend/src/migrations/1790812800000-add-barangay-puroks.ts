import type { Db } from 'mongodb';

/**
 * Backfills the purok vocabulary on barangay records.
 *
 * `Barangay.puroks` is the closed list an incident report's `purok` is validated
 * against. It was added to the schema and to the seeder, but `seedBarangay()`
 * skips a collection that is already seeded, so an existing database never
 * receives it from the seed path. This migration is what reaches those rows.
 *
 * The values are the demo vocabulary implied by the seeded residents
 * (Purok 1-4). They are NOT an authoritative list — Philippine puroks sit below
 * the barangay tier that PSA/PSGC publishes, so no public source confirms them.
 * They live in data precisely so the real list can be corrected later without a
 * code change.
 */
const DEMO_PUROKS = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4'];

export async function up(db: Db): Promise<void> {
  const barangays = db.collection<{ puroks?: string[] | null }>('barangays');

  // Only rows with no list at all. `$addToSet` + `$each` keeps this idempotent,
  // and matching narrowly means a barangay whose list was already curated is
  // left exactly as it is.
  await barangays.updateMany(
    {
      $or: [
        { puroks: { $exists: false } },
        { puroks: null },
        { puroks: { $size: 0 } },
      ],
    },
    { $addToSet: { puroks: { $each: DEMO_PUROKS } } }
  );
}

/**
 * Removes the backfilled values.
 *
 * Best-effort inverse: it cannot tell a value this migration added from one the
 * barangay curated, so it removes the four demo entries from every row.
 */
export async function down(db: Db): Promise<void> {
  const barangays = db.collection<{ puroks?: string[] | null }>('barangays');
  await barangays.updateMany({}, { $pull: { puroks: { $in: DEMO_PUROKS } } });
}
