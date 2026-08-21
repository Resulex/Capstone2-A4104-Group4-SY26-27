import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Message, ChatSession, Admin } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Messages — Delete
 * Use-case: delete a message. Only the message's sender (or an admin) may
 * delete it.
 * DELETE /messages/{id} (authenticated)
 */
export async function deleteMessage(
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
    throw notFoundError('Message not found.');
  }

  let canDelete = false;
  if (auth.role === 'admin') {
    canDelete = true; // admins may delete any message
  } else if (auth.role === 'resident') {
    canDelete = String(message.senderId) === String(session.residentId);
  } else {
    canDelete = String(message.senderId) === auth.userId;
  }
  if (!canDelete) {
    throw notFoundError('Message not found.');
  }

  await message.deleteOne();

  // Decrement session message count.
  if (session.messageCount > 0) session.messageCount -= 1;
  await session.save();

  return ok({ deleted: message.messageId }, 'Message deleted.');
}

export const handler = withErrorHandling(deleteMessage);