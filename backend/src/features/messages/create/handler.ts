import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError, badRequestError } from '../../../shared/errors';
import { Message, ChatSession, Admin } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';
import { sendAdminNotification, sendResidentNotification, residentFullName } from '../../../shared/notifications';

interface CreateMessageBody {
  messageId?: string;
  sessionId?: string;
  messageText?: string;
  formattedContent?: string;
  isUser?: boolean;
  senderId?: string;
}

/**
 * Messages — Create
 * Use-case: send a message in a chat session. The caller must be a participant
 * of the session (resident or the responder admin).
 * POST /messages (authenticated)
 */
export async function createMessage(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const body = parseBody(event) as CreateMessageBody;

  const { messageId, sessionId, messageText } = body;
  if (!messageId || !sessionId || !messageText) {
    return badRequest('messageId, sessionId, and messageText are required.');
  }

  await connectToDatabase();

  const existing = await Message.findOne({ messageId });
  if (existing) {
    throw conflictError('A message with this messageId already exists.');
  }

  const session = await ChatSession.findOne(
    buildIdOrCustomIdQuery(sessionId, 'sessionId')
  );
  if (!session) {
    throw badRequestError('Invalid sessionId.');
  }

  // Determine sender identity + direction.
  let senderId: string;
  let isUser: boolean;
  if (auth.role === 'resident') {
    // Resident: sender is themselves; must be the session resident.
    if (auth.userId !== String(session.residentId)) {
      throw badRequestError('You are not a participant of this session.');
    }
    senderId = String(session.residentId);
    isUser = true;
  } else if (auth.role === 'admin') {
    const admin = await Admin.findOne({ adminId: auth.userId });
    senderId = admin ? String(admin._id) : auth.userId;
    isUser = false;
  } else {
    // Official: sender is their own user id.
    senderId = auth.userId;
    isUser = false;
  }

  // Detect urgency from keywords.
  const urgencyFlag = /\b(emergency|urgent|critical|fire|flood|help|immediately)\b/i.test(
    messageText
  );

  const message = await Message.create({
    messageId,
    sessionId: session._id,
    senderId,
    isUser,
    messageText,
    formattedContent: body.formattedContent || messageText,
    urgencyFlag,
    sentTimestamp: new Date(),
  });

  // Bump session message count + last activity.
  session.messageCount += 1;
  session.lastActivity = new Date();
  await session.save();

  // Notify the session's assigned admin when a resident replies, over the
  // real-time channel.
  if (isUser && session.adminId) {
    const name = await residentFullName(String(session.residentId));
    await sendAdminNotification({
      recipientId: String(session.adminId),
      category: 'chatMessage',
      titleText: 'New Chat Reply',
      messageBody: `${name} replied in live chat: ${messageText}`,
      referenceUrlId: session.incidentId
        ? String(session.incidentId)
        : String(session._id),
    });
  }

  // Notify the session's resident when the responder replies, over the
  // real-time channel.
  if (!isUser && session.residentId) {
    await sendResidentNotification({
      recipientId: String(session.residentId),
      category: 'chatMessage',
      titleText: 'New Message from the Barangay',
      messageBody: `The barangay responded in live chat: ${messageText}`,
      referenceUrlId: session.incidentId
        ? String(session.incidentId)
        : String(session._id),
    });
  }

  return created(message.toObject(), 'Message sent.');
}

export const handler = withErrorHandling(createMessage);