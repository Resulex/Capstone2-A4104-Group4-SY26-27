import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { ChatSession } from '../../../models';
import { resolveAuthContext, residentRecordScopeFilter } from '../../../shared/authorization';
import { archiveScopeFilter } from '../../../shared/archive';
import { staffStartedSessionIds } from '../../../shared/chat-sessions';

/**
 * Chat Sessions — List
 * Use-case: list chat sessions. Residents see only their own, and only once a
 * staff member has started the conversation; admins see all responder sessions.
 * Archived sessions are excluded unless a SUPER_ADMIN asks for `?scope=archived`.
 * GET /chat-sessions?scope=active|archived (authenticated)
 */
export async function listChatSessions(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  // `resolveAuthContext` (not `getAuthContext`): the archived scope needs the
  // admin's `assignedRole`, which only the loaded Admin document carries.
  const auth = await resolveAuthContext(event);
  await connectToDatabase();

  // Residents are scoped to their own sessions, minus anything that predates a
  // resident-initiated account deletion (see `residentRecordScopeFilter`).
  const query = {
    ...(await residentRecordScopeFilter(auth)),
    // Archived threads leave the Live Chat queue for every role; only a
    // SUPER_ADMIN can read them back. This is what keeps the "awaiting reply"
    // badge from counting a conversation nobody can open.
    ...archiveScopeFilter(event, auth),
  };

  const sessions = await ChatSession.find(query).sort({ lastActivity: -1 }).lean();

  // Residents only see chats the barangay has started. An admin opens a triage
  // session the moment they click "Open Triage Chat", so until a staff message
  // exists the session is an internal workspace — listing it would render an
  // empty thread with a working composer in the resident portal.
  let visible = sessions;
  if (auth.role === 'resident') {
    const started = await staffStartedSessionIds(sessions.map((session) => session._id));
    visible = sessions.filter((session) => started.has(String(session._id)));
  }

  return ok(visible, 'Chat sessions fetched.');
}

export const handler = withErrorHandling(listChatSessions);