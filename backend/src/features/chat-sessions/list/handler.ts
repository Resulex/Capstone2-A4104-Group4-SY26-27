import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { ChatSession } from '../../../models';
import { getAuthContext, residentScopeFilter } from '../../../shared/authorization';

/**
 * Chat Sessions — List
 * Use-case: list chat sessions. Residents see only their own; admins see all
 * responder sessions.
 * GET /chat-sessions (authenticated)
 */
export async function listChatSessions(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (auth.role === 'resident') {
    Object.assign(query, residentScopeFilter(auth));
  }

  const sessions = await ChatSession.find(query).sort({ lastActivity: -1 }).lean();
  return ok(sessions, 'Chat sessions fetched.');
}

export const handler = withErrorHandling(listChatSessions);