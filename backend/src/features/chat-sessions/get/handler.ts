import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { ChatSession } from '../../../models';
import { getAuthContext, assertOwnResidentRecord } from '../../../shared/authorization';

/**
 * Chat Sessions — Get
 * Use-case: fetch a single chat session. Residents see only their own;
 * admins see any responder session.
 * GET /chat-sessions/{id} (authenticated)
 */
export async function getChatSession(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const session = await ChatSession.findOne(
    buildIdOrCustomIdQuery(id, 'sessionId')
  );
  if (!session) {
    throw notFoundError('Chat session not found.');
  }

  assertOwnResidentRecord(auth, session.residentId);
  return ok(session.toObject(), 'Chat session fetched.');
}

export const handler = withErrorHandling(getChatSession);