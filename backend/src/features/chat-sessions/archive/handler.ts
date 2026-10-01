import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import {
  withErrorHandling,
  parseOptionalBody,
  parsePathParam,
  buildIdOrCustomIdQuery,
} from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { ChatSession, Notification } from '../../../models';
import { requireSuperAdmin, resolveAuthContext } from '../../../shared/authorization';

/**
 * Chat Sessions — Archive / Restore
 *
 * Use-case: retire a conversation from the Live Chat queue without losing it.
 * This is the "communications" half of the retention requirement: messages are
 * never deleted, and archiving a session hides the thread from the queue while
 * keeping every message readable in the Archived view.
 *
 * Archiving also clears `isActive`, because an archived session is by definition
 * no longer a live thread. Restoring deliberately does NOT set it back: a
 * restored session is history, not a conversation anyone is waiting on.
 *
 * SUPER_ADMIN only — chat belongs to the operations queue, so the clerks keep
 * working the thread and cannot make it vanish.
 *
 * POST /chat-sessions/{id}/archive   (super admin)
 * POST /chat-sessions/{id}/restore   (super admin)
 */

async function archive(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const session = await ChatSession.findOne(buildIdOrCustomIdQuery(id, 'sessionId'));
  if (!session) {
    throw notFoundError('Chat session not found.');
  }

  if (!session.isArchived) {
    const body = parseOptionalBody(event);
    const reason =
      typeof body.reason === 'string' ? body.reason.trim() || undefined : undefined;

    session.isArchived = true;
    session.isActive = false;
    session.archivedAt = new Date();
    session.archivedBy = auth.admin?.adminId;
    session.archivedReason = reason;

    await session.save();

    // Chat notifications reference the session's `sessionId`, so the same
    // read-on-archive rule applies: the badge must not outlive the queue row.
    await Notification.updateMany({ referenceUrlId: session.sessionId }, { isRead: true });
  }

  return ok(session.toObject(), 'Chat session archived.');
}

async function restore(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const session = await ChatSession.findOne(buildIdOrCustomIdQuery(id, 'sessionId'));
  if (!session) {
    throw notFoundError('Chat session not found.');
  }

  if (session.isArchived) {
    session.isArchived = false;
    session.archivedAt = undefined;
    session.archivedBy = undefined;
    session.archivedReason = undefined;
    // `isActive` is intentionally left false — see the header comment.

    await session.save();
  }

  return ok(session.toObject(), 'Chat session restored.');
}

// Both routes point at the WRAPPED exports. Registering the raw functions in
// `serverless.yml` would let a thrown AppError escape `withErrorHandling`, so a
// non-super admin's 403 would surface as an opaque 502 instead.
export const archiveHandler = withErrorHandling(archive);
export const restoreHandler = withErrorHandling(restore);
