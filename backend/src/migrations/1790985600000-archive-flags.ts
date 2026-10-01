import { createSeededIndexes, dropSeededIndexes } from './indexes';
import type { Db } from 'mongodb';

/**
 * Migration: soft-archive flags for incidents, document requests, announcements
 * and chat sessions.
 *
 * Two things happen here, and the order matters.
 *
 * 1. `isArchived` is backfilled to `false` on every pre-existing document. The
 *    schema declares `default: false`, but a default only applies on write, so
 *    rows created before the field existed simply lack the key. Backfilling
 *    makes the flag explicit (so the field can be reported on and indexed
 *    consistently) — but it is NOT what keeps those rows visible: the active
 *    scope matches "not equal to true" precisely so an un-migrated database
 *    still lists everything.
 *
 * 2. The archive indexes are created through the shared registry, so adding them
 *    to `SEEDED_INDEXES` is enough. The original create-seeded-indexes migration
 *    is already recorded in `schema_migrations` and will never run again, which
 *    is exactly why a new migration is required to pick the new keys up.
 *
 * Residents and officials are deliberately NOT touched: their `isDeleted` flag
 * has existed since the collections were seeded, so there is nothing to
 * backfill and no new column to index beyond `idx_residents_deleted` (which the
 * index registry handles above).
 */
const ARCHIVE_COLLECTIONS = [
  'incidentreports',
  'documentrequests',
  'announcements',
  'chatsessions',
] as const;

export async function up(db: Db): Promise<void> {
  for (const collection of ARCHIVE_COLLECTIONS) {
    await db
      .collection(collection)
      .updateMany(
        { isArchived: { $exists: false } },
        { $set: { isArchived: false } }
      );
  }

  await createSeededIndexes(db);
}

/**
 * Removes the backfilled flag and the indexes this migration created.
 *
 * Dropping the flag returns the collections to "field absent", which the
 * handlers' active scope still tolerates — the archive view is the only thing
 * that would stop resolving, and it is gated behind `isArchived: true`.
 */
export async function down(db: Db): Promise<void> {
  for (const collection of ARCHIVE_COLLECTIONS) {
    await db.collection(collection).updateMany({}, { $unset: { isArchived: '' } });
  }

  await dropSeededIndexes(db);
}
