import { connectToDatabase } from '../../../config/db';
import { Resident } from '../../../models';

/**
 * Residents — Deletion Sweep (scheduled)
 *
 * Use-case: finalize resident-initiated account deletions whose 30-day grace
 * window has elapsed. Finalizing only stamps `deletionFinalizedAt`: nothing is
 * removed from the database, because admins must keep seeing the deleted
 * resident's documents, incident reports, chat sessions and history.
 *
 * Triggered by EventBridge (`events: - schedule: rate(1 day)` in
 * `serverless.yml`) — the only scheduled function in the service, so there is
 * no HTTP event and no `verify:routes` entry.
 *
 * `serverless-offline` does NOT execute `schedule` events, so the resident
 * session check (`features/auth/session`) applies the same finalization lazily.
 * That makes this sweep a backstop for accounts nobody signs into again rather
 * than the only path.
 */
export async function finalizeDueDeletions(): Promise<{ finalized: number }> {
  await connectToDatabase();

  const now = new Date();
  const result = await Resident.updateMany(
    {
      deletionScheduledFor: { $lte: now },
      deletionFinalizedAt: { $exists: false },
    },
    { $set: { deletionFinalizedAt: now } }
  );

  return { finalized: result.modifiedCount ?? 0 };
}

export async function handler(): Promise<void> {
  const { finalized } = await finalizeDueDeletions();
  // CloudWatch is the only observer of a scheduled invocation.
  console.log(`[residents-deletion-sweep] finalized ${finalized} account deletion(s).`);
}
