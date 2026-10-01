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
import { DocumentRequest, Notification } from '../../../models';
import {
  actorIdentity,
  requireSuperAdmin,
  resolveAuthContext,
} from '../../../shared/authorization';

/**
 * Document Requests — Archive / Restore
 *
 * Use-case: retire a released or otherwise finished request from the queue
 * without destroying it, and bring it back later. `currentStatus` is left
 * untouched, so the processing history stays exactly as the clerks left it.
 *
 * SUPER_ADMIN only — a records-governance action rather than part of the
 * queue-clerk's workflow.
 *
 * POST /document-requests/{id}/archive   (super admin)
 * POST /document-requests/{id}/restore   (super admin)
 */

/** The optional archive note, read defensively because the body may be absent. */
function readReason(event: APIGatewayProxyEvent): string | undefined {
  const body = parseOptionalBody(event);
  return typeof body.reason === 'string' ? body.reason.trim() || undefined : undefined;
}

async function archive(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const request = await DocumentRequest.findOne(buildIdOrCustomIdQuery(id, 'requestId'));
  if (!request) {
    throw notFoundError('Document request not found.');
  }

  // Idempotent: a repeated archive must not append a second history entry.
  if (!request.isArchived) {
    const reason = readReason(event);
    const actor = await actorIdentity(auth);
    const stamp = new Date();

    request.isArchived = true;
    request.archivedAt = stamp;
    request.archivedBy = auth.admin?.adminId;
    request.archivedReason = reason;

    // Append-only history, mirroring how status changes are recorded: the entry
    // documents who archived it and why without rewriting the reached status.
    if (!Array.isArray(request.timeline)) request.timeline = [];
    request.timeline.push({
      step: 'Archived',
      date: stamp,
      status: 'Archived',
      remarks: reason,
      changedBy: actor ?? undefined,
    });

    // Only a supplied reason moves the scalar mirror; see the incident handler.
    if (reason) request.remarks = reason;

    await request.save();

    await Notification.updateMany({ referenceUrlId: request.requestId }, { isRead: true });
  }

  return ok(request.toObject(), 'Document request archived.');
}

async function restore(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const request = await DocumentRequest.findOne(buildIdOrCustomIdQuery(id, 'requestId'));
  if (!request) {
    throw notFoundError('Document request not found.');
  }

  if (request.isArchived) {
    const actor = await actorIdentity(auth);

    request.isArchived = false;
    request.archivedAt = undefined;
    request.archivedBy = undefined;
    request.archivedReason = undefined;

    if (!Array.isArray(request.timeline)) request.timeline = [];
    request.timeline.push({
      step: 'Restored',
      date: new Date(),
      status: 'Restored',
      changedBy: actor ?? undefined,
    });

    await request.save();
  }

  return ok(request.toObject(), 'Document request restored.');
}

// Both routes point at the WRAPPED exports. Registering the raw functions in
// `serverless.yml` would let a thrown AppError escape `withErrorHandling`, so a
// non-super admin's 403 would surface as an opaque 502 instead.
export const archiveHandler = withErrorHandling(archive);
export const restoreHandler = withErrorHandling(restore);
