import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Message, ChatSession, Admin } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Messages — Update
 * Use-case: update a message (e.g. edit text / formatted content). Caller
 * must be the message's sender.
 * PATCH /messages/{id} (authenticated)
 */
export async function updateMessage(
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

  // Only the sender may edit their own message.
  const session = await ChatSession.findById(message.sessionId);
  if (!session) {
    throw notFoundError('Message not found.');
  }

  let senderMatches = false;
  if (auth.role === 'resident') {
    senderMatches = String(message.senderId) === String(session.residentId);
  } else if (auth.role === 'admin') {
    const admin = await Admin.findOne({ adminId: auth.userId });
    const adminId = admin ? admin._id : auth.userId;
    senderMatches = String(message.senderId) === String(adminId);
  } else {
    senderMatches = String(message.senderId) === auth.userId;
  }
  if (!senderMatches) {
    throw notFoundError('Message not found.');
  }

  const body = parseBody(event) as { messageText?: string; formattedContent?: string };
  if (body.messageText !== undefined) message.messageText = body.messageText;
  if (body.formattedContent !== undefined) message.formattedContent = body.formattedContent;

  await message.save();
  return ok(message.toObject(), 'Message updated.');
}

export const handler = withErrorHandling(updateMessage);