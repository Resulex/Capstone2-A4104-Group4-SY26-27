import { Message } from '../models';

/**
 * Live chat "started" state.
 *
 * A chat session is the barangay's internal workspace the moment an admin opens
 * one from an incident — "Open Triage Chat" creates the session before a single
 * byte is written into it. It only becomes the RESIDENT's conversation once a
 * staff member (admin or official) has actually posted, so every
 * resident-facing chat path gates on the facts below. Without the gate the
 * resident portal lists the empty session and opens a thread with a working
 * composer for a chat nobody has started.
 *
 * Derived from `Message` rather than `ChatSession.lastStaffReplyAt` so the fact
 * needs no backfill/migration, and so it stays correct when the first staff
 * message is deleted (`features/messages/delete` re-derives the timestamp from
 * whatever messages remain). Staff paths are never gated: the queue must keep
 * showing an unstarted session so it can be answered.
 */

/** Whether any staff member has already posted in the session. */
export async function sessionHasStaffMessage(
  sessionId: unknown
): Promise<boolean> {
  if (!sessionId) return false;
  return (await Message.exists({ sessionId, isUser: false })) !== null;
}

/**
 * The subset of `sessionIds` staff have already posted in, as strings.
 *
 * One extra query per list call. `Message.sessionId` is indexed, and the caller
 * only ever passes a single resident's sessions, so this stays cheap.
 */
export async function staffStartedSessionIds(
  sessionIds: unknown[]
): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();

  const started = await Message.distinct('sessionId', {
    sessionId: { $in: sessionIds },
    isUser: false,
  });
  return new Set(started.map((id) => String(id)));
}
