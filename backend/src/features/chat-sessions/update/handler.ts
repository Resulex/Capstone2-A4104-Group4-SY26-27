import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { ChatSession } from '../../../models';
import { getAuthContext, assertOwnResidentRecord } from '../../../shared/authorization';

interface UpdateChatSessionBody {
  isActive?: boolean;
  messageCount?: number;
  lastActivity?: string;
}

/**
 * Chat Sessions — Update
 * Use-case: update a chat session (e.g. mark active/inactive, bump message
 * count). Residents update only their own; admins update any.
 * PATCH /chat-sessions/{id} (authenticated)
 */
export async function updateChatSession(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const session = await ChatSession.findOne(buildIdOrCustomIdQuery(id, 'sessionId'));
  if (!session) {
    throw notFoundError('Chat session not found.');
  }

  assertOwnResidentRecord(auth, session.residentId);

  const body = parseBody(event) as UpdateChatSessionBody;
  if (body.isActive !== undefined) session.isActive = body.isActive;
  if (body.messageCount !== undefined) session.messageCount = body.messageCount;
  if (body.lastActivity !== undefined) session.lastActivity = new Date(body.lastActivity);

  await session.save();
  return ok(session.toObject(), 'Chat session updated.');
}

export const handler = withErrorHandling(updateChatSession);