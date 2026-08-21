import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok, badRequest } from '../../../shared/responses';
import { Message, ChatSession, Admin } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Messages — List
 * Use-case: list messages. Optionally filtered by sessionId. The caller must
 * be a participant of the queried session (resident or responder admin).
 * POST /messages/list (authenticated) — uses a POST body filter to avoid
 * complex query params.
 */
export async function listMessages(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const body = parseBody(event) as { sessionId?: string };

  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (body.sessionId) {
    const session = await ChatSession.findOne({
      $or: [{ _id: body.sessionId }, { sessionId: body.sessionId }],
    });
    if (!session) {
      return badRequest('Invalid sessionId.');
    }

    // Participant check: residents only their own sessions; admins are
    // responders; officials allowed.
    if (auth.role === 'resident') {
      if (auth.userId !== String(session.residentId)) {
        return badRequest('You are not a participant of this session.');
      }
      query.sessionId = session._id;
    } else if (auth.role === 'admin') {
      const admin = await Admin.findOne({ adminId: auth.userId });
      const adminId = admin ? admin._id : auth.userId;
      if (String(adminId) !== String(session.adminId)) {
        return badRequest('You are not a participant of this session.');
      }
      query.sessionId = session._id;
    } else {
      query.sessionId = session._id;
    }
  } else {
    // No session filter: scope by participation via session lookup.
    if (auth.role === 'resident') {
      const sessions = await ChatSession.find({ residentId: auth.userId }).select('_id').lean();
      query.sessionId = { $in: sessions.map((s) => s._id) };
    } else if (auth.role === 'admin') {
      const admin = await Admin.findOne({ adminId: auth.userId });
      const adminId = admin ? admin._id : auth.userId;
      const sessions = await ChatSession.find({ adminId }).select('_id').lean();
      query.sessionId = { $in: sessions.map((s) => s._id) };
    }
    // Officials see all messages (barangay scope).
  }

  const messages = await Message.find(query).sort({ sentTimestamp: 1 }).lean();
  return ok(messages, 'Messages fetched.');
}

export const handler = withErrorHandling(listMessages);