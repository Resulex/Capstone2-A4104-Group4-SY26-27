import type { Db } from 'mongodb';

/**
 * Backfill the shared "awaiting reply" timestamps on chat sessions.
 *
 * `ChatSession.lastResidentMessageAt` / `lastStaffReplyAt` are the SHARED queue
 * state that replaced per-admin unread rows as the thing the Live Chat badge and
 * bold rows key off (see `needsReply()` in the frontend). Messages written before
 * those fields existed carry no session-level copy of that fact, so every session
 * would render as "not awaiting a reply" until a new message happened — i.e. the
 * whole existing backlog would silently disappear from the queue.
 *
 * Both fields are optional and the UI degrades to "not awaiting", so this is a
 * fidelity backfill rather than a hard requirement; it is still worth applying so
 * a half-answered queue looks the same before and after the deploy.
 *
 * Operates on the native `db` (like the other migrations) because it reads raw
 * documents and `isUser` is the only discriminator it needs.
 */
export async function up(db: Db): Promise<void> {
  const sessions = db.collection('chatsessions');
  const messages = db.collection('messages');

  const cursor = sessions.find({});
  for await (const session of cursor) {
    const [lastResident, lastStaff] = await Promise.all([
      messages
        .find({ sessionId: session._id, isUser: true })
        .sort({ sentTimestamp: -1 })
        .limit(1)
        .next(),
      messages
        .find({ sessionId: session._id, isUser: false })
        .sort({ sentTimestamp: -1 })
        .limit(1)
        .next(),
    ]);

    if (!lastResident && !lastStaff) continue;

    const set: Record<string, unknown> = {};
    if (lastResident) {
      set.lastResidentMessageAt = lastResident.sentTimestamp;
    }
    if (lastStaff) {
      set.lastStaffReplyAt = lastStaff.sentTimestamp;
      // `Message.senderId` deliberately has no `ref` (it points at an Admin for
      // admins and a Resident for officials), so resolve the display name the same
      // way `actorIdentity()` does at runtime: try the admin collection, then
      // residents. Both lookups miss for a re-provisioned account, which is fine —
      // the timestamp still carries the state, only the name is unknown.
      set.lastStaffReplyById = lastStaff.senderId;
      const name = await senderDisplayName(db, lastStaff.senderId);
      if (name) set.lastStaffReplyByName = name;
    }

    await sessions.updateOne({ _id: session._id }, { $set: set });
  }
}

/** Reverts the backfill; the fields were absent before this migration. */
export async function down(db: Db): Promise<void> {
  await db.collection('chatsessions').updateMany(
    {},
    {
      $unset: {
        lastResidentMessageAt: '',
        lastStaffReplyAt: '',
        lastStaffReplyById: '',
        lastStaffReplyByName: '',
      },
    },
  );
}

/** Full name of an admin or resident by `_id`, or null when neither matches. */
async function senderDisplayName(
  db: Db,
  senderId: unknown,
): Promise<string | null> {
  if (!senderId) return null;

  const admin = await db.collection('admins').findOne({ _id: senderId as never });
  if (admin) {
    return (
      [admin.firstName, admin.middleName, admin.lastName]
        .filter(Boolean)
        .join(' ') ||
      (typeof admin.userName === 'string' ? admin.userName : null)
    );
  }

  const resident = await db
    .collection('residents')
    .findOne({ _id: senderId as never });
  if (resident) {
    return (
      [resident.firstName, resident.middleName, resident.lastName, resident.suffix]
        .filter(Boolean)
        .join(' ') || null
    );
  }

  return null;
}
