import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError, badRequestError } from '../../../shared/errors';
import { Message, ChatSession, Admin } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Verifies the caller is a participant of the message's session.
 * Throws 404 (not found) for non-participants to avoid data leakage.
 */
async function assertMessageParticipant(
  auth: { role: string; userId: string },
  session: { residentId: unknown; adminId: unknown }
): Promise<void> {
  if (auth.role === 'resident') {
    if (auth.userId !== String(session.residentId)) {
      throw notFoundError('Message not found.');
    }
  } else if (auth.role === 'admin') {
    const admin = await Admin.findOne({ adminId: auth.userId });
    const adminId = admin ? admin._id : auth.userId;
    if (String(adminId) !== String(session.adminId)) {
      throw notFoundError('Message not found.');
    }
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

  const message = await Message.findOne({
    $or: [{ _id: id }, { messageId: id }],
  });
  if (!message) {
    throw notFoundError('Message not found.');
  }

  const session = await ChatSession.findById(message.sessionId);
  if (!session) {
    throw badRequestError('Message session not found.');
  }

  await assertMessageParticipant(auth, session);
  return ok(message.toObject(), 'Message fetched.');
}

export const handler = withErrorHandling(getMessage);