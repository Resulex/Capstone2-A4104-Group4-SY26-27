import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok, badRequest } from '../../../shared/responses';
import { Message, ChatSession } from '../../../models';
import {
  getAuthContext,
  canReadSessionMessages,
  isResidentRecordHidden,
  residentRecordScopeFilter,
} from '../../../shared/authorization';

/**
 * Messages — List
 * Use-case: list messages. Optionally filtered by sessionId. A resident must
 * be a participant of the queried session; admins/officials share the chat
 * queue and may read any session (see `canReadSessionMessages`).
 * POST /messages/search (authenticated) — uses a POST body filter to avoid
 * complex query params.
 */
export async function listMessages(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const body = parseBody(event) as { sessionId?: string };

  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (body.sessionId) {
    const session = await ChatSession.findOne(
      buildIdOrCustomIdQuery(body.sessionId, 'sessionId')
    );
    if (!session) {
      return badRequest('Invalid sessionId.');
    }

    // Access check: residents only their own sessions; staff share the queue.
    // A session from the resident's deleted era is reported exactly like an
    // unknown id, so the thread cannot be reached by URL either.
    if (
      !canReadSessionMessages(auth, session) ||
      (await isResidentRecordHidden(auth, session))
    ) {
      return badRequest('You are not a participant of this session.');
    }
    query.sessionId = session._id;
  } else {
    // No session filter: residents are scoped to their own sessions by session
    // lookup; admins and officials see every message (shared queue / barangay
    // scope).
    if (auth.role === 'resident') {
      // Deletion-aware scope: sessions from before the deletion are excluded, so
      // their messages drop out of an unfiltered search too.
      const sessions = await ChatSession.find(await residentRecordScopeFilter(auth))
        .select('_id')
        .lean();
      query.sessionId = { $in: sessions.map((s) => s._id) };
    }
  }

  const messages = await Message.find(query).sort({ sentTimestamp: 1 }).lean();
  return ok(messages, 'Messages fetched.');
}

export const handler = withErrorHandling(listMessages);