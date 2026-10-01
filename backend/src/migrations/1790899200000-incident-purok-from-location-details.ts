import type { Db } from 'mongodb';

/**
 * Backfills `IncidentReport.purok` from the legacy free-text `locationDetails`.
 *
 * Reports filed before the validated purok field existed carry their location as
 * prose (e.g. "Low-lying area of Purok 4"). Every seeded record embeds a
 * parseable "Purok N" token, so the structured value can be recovered rather
 * than guessed. Records with no recognizable token keep a null `purok`, and the
 * UI degrades to the legacy text instead of inventing a value.
 *
 * `locationDetails` itself is left untouched: it remains the frozen legacy text
 * that older records render from, and is no longer writable by clients.
 *
 * The parsed value is only written when the barangay actually recognises it,
 * and in the barangay's own spelling. Copying an unrecognized token (old test
 * data contains a stray "Purok 11") would leave `purok` outside the very
 * vocabulary the API enforces; those records keep a null purok and the UI falls
 * back to their legacy text.
 *
 * The vocabulary is read from the oldest active barangay, the same way the
 * runtime resolves it for a resident with no barangay reference.
 */
const PUROK_PATTERN = /purok\s*(\d+)/i;

/** Subset of the incident document this migration reads and writes. */
interface IncidentPurokDoc {
  purok?: string | null;
  locationDetails?: string | null;
}

/**
 * Normalization is inlined rather than imported from `shared/puroks.ts`: a
 * migration is a snapshot of the rules as they were when it ran, and importing
 * app code would let a later edit silently change what an old migration does.
 */
function keyOf(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The barangay purok vocabulary, matching the runtime's resolution order. */
async function loadVocabulary(db: Db): Promise<string[]> {
  const barangays = db.collection<{
    puroks?: string[] | null;
    isActive?: boolean;
    createdAt?: Date;
  }>('barangays');

  const doc =
    (await barangays.findOne({ isActive: true }, { sort: { createdAt: 1 } })) ??
    (await barangays.findOne({}, { sort: { createdAt: 1 } }));

  return (doc?.puroks ?? []).filter(
    (purok): purok is string => typeof purok === 'string' && !!purok.trim()
  );
}

export async function up(db: Db): Promise<void> {
  const incidents = db.collection<IncidentPurokDoc>('incidentreports');

  // Without a vocabulary there is nothing to validate against, so every parsed
  // value would be a guess. Leaves `purok` null and the legacy text in place.
  const vocabulary = await loadVocabulary(db);
  if (vocabulary.length === 0) return;

  const canonicalByKey = new Map(
    vocabulary.map((purok) => [keyOf(purok), purok])
  );

  const cursor = incidents.find({
    $and: [
      { $or: [{ purok: { $exists: false } }, { purok: null }, { purok: '' }] },
      { locationDetails: { $type: 'string' } },
    ],
  });

  for await (const doc of cursor) {
    const match = PUROK_PATTERN.exec(String(doc.locationDetails ?? ''));
    if (!match) continue;

    const canonical = canonicalByKey.get(keyOf(`Purok ${match[1]}`));
    if (!canonical) continue;

    await incidents.updateOne({ _id: doc._id }, { $set: { purok: canonical } });
  }
}

/**
 * Clears the inferred values.
 *
 * Narrowed to a purok that matches the token already present in the legacy text,
 * so a purok set through the API (which has no such correspondence) is not
 * mistaken for one this migration added.
 */
export async function down(db: Db): Promise<void> {
  const incidents = db.collection<IncidentPurokDoc>('incidentreports');

  const docs = await incidents
    .find({
      purok: { $regex: /^Purok \d+$/ },
      locationDetails: { $type: 'string' },
    })
    .toArray();

  for (const doc of docs) {
    const match = PUROK_PATTERN.exec(String(doc.locationDetails ?? ''));
    if (!match) continue;
    if (String(doc.purok) !== `Purok ${match[1]}`) continue;

    await incidents.updateOne({ _id: doc._id }, { $unset: { purok: '' } });
  }
}
