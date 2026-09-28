import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { ChatSession } from '../../../models';
import { getAuthContext, assertOwnResidentRecord, assertResidentRecordVisible } from '../../../shared/authorization';
import { sessionHasStaffMessage } from '../../../shared/chat-sessions';

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
  // A session that predates the resident's own account deletion is gone from
  // their view: same 404 as one that never existed.
  await assertResidentRecordVisible(auth, session, 'Chat session');
  // A chat the barangay has not started is addressed by URL the same way as one
  // that never existed: the resident cannot open it directly.
  if (auth.role === 'resident' && !(await sessionHasStaffMessage(session._id))) {
    throw notFoundError('Chat session not found.');
  }
  return ok(session.toObject(), 'Chat session fetched.');
}

export const handler = withErrorHandling(getChatSession);