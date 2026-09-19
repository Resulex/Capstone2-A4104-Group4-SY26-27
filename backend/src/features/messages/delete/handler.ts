import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Message, ChatSession } from '../../../models';
import { getAuthContext, senderDisplayName } from '../../../shared/authorization';

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

  const message = await Message.findOne(buildIdOrCustomIdQuery(id, 'messageId'));
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

  // Re-derive the SHARED "awaiting reply" state from what is left, rather than
  // trying to unpick the deleted message's effect on it: deleting the only staff
  // reply must put the session back into the queue, and deleting the resident's
  // last message must take it out. Two indexed lookups on a rare admin action.
  const remaining = await Message.find({ sessionId: session._id })
    .select('isUser sentTimestamp senderId')
    .lean();
  const latestFrom = (fromResident: boolean) => {
    let latest: (typeof remaining)[number] | undefined;
    for (const msg of remaining) {
      if (msg.isUser !== fromResident) continue;
      if (!latest || new Date(msg.sentTimestamp) > new Date(latest.sentTimestamp)) {
        latest = msg;
      }
    }
    return latest;
  };

  const lastResident = latestFrom(true);
  const lastStaff = latestFrom(false);

  session.lastResidentMessageAt = lastResident
    ? new Date(lastResident.sentTimestamp)
    : undefined;
  session.lastStaffReplyAt = lastStaff
    ? new Date(lastStaff.sentTimestamp)
    : undefined;

  if (lastStaff) {
    // Re-derive the attribution too: keeping the deleted reply's name would credit
    // whoever was unlucky enough to be the last sender of a message that no longer
    // exists, while an older reply is now the one that answered the resident.
    session.lastStaffReplyById = lastStaff.senderId;
    session.lastStaffReplyByName =
      (await senderDisplayName(lastStaff.senderId)) ?? undefined;
  } else {
    session.lastStaffReplyById = undefined;
    session.lastStaffReplyByName = undefined;
  }

  await session.save();

  return ok({ deleted: message.messageId }, 'Message deleted.');
}

export const handler = withErrorHandling(deleteMessage);