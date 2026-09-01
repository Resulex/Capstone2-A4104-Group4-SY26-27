import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { ChatSession } from '../../../models';
import { getAuthContext, assertOwnResidentRecord } from '../../../shared/authorization';

/**
 * Chat Sessions — Delete
 * Use-case: delete a chat session. Residents delete only their own; admins
 * may delete any.
 * DELETE /chat-sessions/{id} (authenticated)
 */
export async function deleteChatSession(
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
  await session.deleteOne();
  return ok({ deleted: session.sessionId }, 'Chat session deleted.');
}

export const handler = withErrorHandling(deleteChatSession);