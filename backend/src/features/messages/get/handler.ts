import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError, badRequestError } from '../../../shared/errors';
import { Message, ChatSession } from '../../../models';
import {
  getAuthContext,
  canReadSessionMessages,
  type AuthContext,
} from '../../../shared/authorization';

/**
 * Verifies the caller may read the message's session: residents only their own
 * sessions, admins/officials the whole shared queue (`canReadSessionMessages`).
 * Throws 404 (not found) for non-participants to avoid data leakage.
 */
function assertMessageParticipant(
  auth: AuthContext,
  session: { residentId: unknown }
): void {
  if (!canReadSessionMessages(auth, session)) {
    throw notFoundError('Message not found.');
  }
}

/**
 * Messages — Get
 * Use-case: fetch a single message. Caller must be a session participant.
 * GET /messages/{id} (authenticated)
 */
export async function getMessage(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const message = await Message.findOne(
    buildIdOrCustomIdQuery(id, 'messageId')
  );
  if (!message) {
    throw notFoundError('Message not found.');
  }

  const session = await ChatSession.findById(message.sessionId);
  if (!session) {
    throw badRequestError('Message session not found.');
  }

  assertMessageParticipant(auth, session);
  return ok(message.toObject(), 'Message fetched.');
}

export const handler = withErrorHandling(getMessage);