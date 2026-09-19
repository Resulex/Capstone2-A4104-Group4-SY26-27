import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import mongoose from 'mongoose';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError, badRequestError } from '../../../shared/errors';
import { Message, ChatSession, Admin, type IChatSession } from '../../../models';
import { getAuthContext, actorIdentity, CHAT_STAFF_ROLES } from '../../../shared/authorization';
import {
  notifyAllActiveAdmins,
  sendResidentNotification,
  residentFullName,
  activeAdminIdsByRole,
} from '../../../shared/notifications';
import { broadcastToAdmins } from '../../../shared/ws';

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

  // Stamp the SHARED "awaiting reply" state. `isUser` is the resident flag, so
  // these two branches are exactly the two directions of the conversation: a
  // resident message starts the wait, a staff reply ends it for the whole team.
  if (isUser) {
    session.lastResidentMessageAt = session.lastActivity;
  } else {
    session.lastStaffReplyAt = session.lastActivity;
    const actor = await actorIdentity(auth);
    // The name is the part the queue renders, so keep it even if the id is not a
    // castable ObjectId — officials reply through the resident portal and their
    // token `sub` is a Resident `_id`, which is what gets stored either way.
    if (actor) {
      if (mongoose.isValidObjectId(actor.userId)) {
        session.lastStaffReplyById = new mongoose.Types.ObjectId(actor.userId);
      }
      session.lastStaffReplyByName = actor.fullName;
    }
  }

  await session.save();

  // Notify EVERY active admin when a resident replies.
  //
  // Chat is a shared staff queue: `chat-sessions/list` returns every session to
  // every admin and any admin may reply, so addressing this to `session.adminId`
  // alone left whoever was actually watching the console with no notification
  // row — hence no bell entry and no Live Chat badge — and it vanished entirely
  // once that responder account was re-provisioned (the session then points at a
  // dangling Admin id). Incidents and documents already notify all admins.
  //
  // Narrowed to `CHAT_STAFF_ROLES` because those are the only roles that can open
  // /admin/chat-sessions; alerting an INFO_OFFICER produced a bell entry with no
  // destination. The call returns the ids it notified, so the shared-state push
  // below reaches exactly the same admins off ONE Admin lookup.
  //
  // `referenceUrlId` is the session's own id, so one chat session maps to one
  // unread record; the chat list still accepts the legacy incident-based value,
  // so notifications written earlier resolve too.
  if (isUser && session.residentId) {
    const name = await residentFullName(String(session.residentId));
    const staffAdminIds = await notifyAllActiveAdmins(
      {
        category: 'chatMessage',
        titleText: 'New Chat Reply',
        messageBody: `${name} replied in live chat: ${messageText}`,
        referenceUrlId: session.sessionId,
      },
      { roles: CHAT_STAFF_ROLES }
    );
    await broadcastToAdmins(staffAdminIds, {
      type: 'chatSessionUpdated',
      session: chatSessionPayload(session),
    });
  } else if (!isUser) {
    // A staff reply ANSWERS the session for everyone. Push the new shared state
    // so a teammate's queue row un-bolds and its badge drops without a reload —
    // their own per-admin bell entry is untouched, because they still were not the
    // one who saw the reply arrive. No notification rows here: staff who did not
    // reply have nothing to be told about their own team's action.
    await broadcastToAdmins(await activeAdminIdsByRole(CHAT_STAFF_ROLES), {
      type: 'chatSessionUpdated',
      session: chatSessionPayload(session),
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

/**
 * The slice of a chat session pushed over the WebSocket when its shared
 * "awaiting reply" state changes.
 *
 * Built explicitly rather than `session.toObject()`: the client MERGES this into
 * the row it already holds, so the contract is the fields that decide bolding
 * plus the counters the queue renders — not device/IP metadata, and not the
 * ObjectIds whose raw shape varies between `lean()` reads and hydrated docs.
 */
function chatSessionPayload(session: IChatSession) {
  return {
    sessionId: session.sessionId,
    incidentId: String(session.incidentId),
    residentId: String(session.residentId),
    adminId: String(session.adminId),
    isActive: session.isActive,
    messageCount: session.messageCount,
    lastActivity: session.lastActivity,
    lastResidentMessageAt: session.lastResidentMessageAt ?? null,
    lastStaffReplyAt: session.lastStaffReplyAt ?? null,
    lastStaffReplyByName: session.lastStaffReplyByName ?? null,
  };
}

export const handler = withErrorHandling(createMessage);