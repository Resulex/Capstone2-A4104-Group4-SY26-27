import type { Db } from 'mongodb';

/**
 * Normalize incident report IDs to the INC-<year><5-digit sequence> format
 * (e.g. INC-202600001). Legacy/seed records used `inc-<seq>` (e.g. inc-001).
 * Also updates notifications that deep-linked to the old id via
 * `referenceUrlId`. Chat sessions reference incidents by ObjectId, so they are
 * unaffected.
 */
export async function up(db: Db): Promise<void> {
  const incidents = db.collection('incidentreports');
  const notifications = db.collection('notifications');

  const cursor = incidents.find({ incidentId: { $regex: /^inc-\d+$/ } });
  for await (const doc of cursor) {
    const seq = parseInt(String(doc.incidentId).replace(/^inc-/, ''), 10);
    if (Number.isNaN(seq)) continue;

    const year = doc.reportedAt
      ? new Date(doc.reportedAt).getFullYear()
      : new Date().getFullYear();
    const newId = `INC-${year}${String(seq).padStart(5, '0')}`;

    await incidents.updateOne({ _id: doc._id }, { $set: { incidentId: newId } });
    await notifications.updateMany(
      { referenceUrlId: doc.incidentId },
      { $set: { referenceUrlId: newId } },
    );
  }
}

/** Reverts INC-<year><5-digit> ids back to the legacy `inc-<seq>` format. */
export async function down(db: Db): Promise<void> {
  const incidents = db.collection('incidentreports');
  const notifications = db.collection('notifications');

  const docs = await incidents
    .find({ incidentId: { $regex: /^INC-\d{9}$/ } })
    .toArray();

  for (const doc of docs) {
    const seq = parseInt(String(doc.incidentId).slice(-5), 10);
    if (Number.isNaN(seq)) continue;

    const oldId = `inc-${String(seq).padStart(3, '0')}`;
    await incidents.updateOne({ _id: doc._id }, { $set: { incidentId: oldId } });
    await notifications.updateMany(
      { referenceUrlId: doc.incidentId },
      { $set: { referenceUrlId: oldId } },
    );
  }
}
