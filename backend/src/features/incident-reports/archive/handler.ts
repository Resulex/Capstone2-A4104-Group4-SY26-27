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
import { IncidentReport, Notification } from '../../../models';
import {
  actorIdentity,
  requireSuperAdmin,
  resolveAuthContext,
} from '../../../shared/authorization';

/**
 * Incident Reports — Archive / Restore
 *
 * Use-case: retire a report from every queue without destroying it, and bring it
 * back later. The record, its evidence links and its complete status history are
 * retained; archiving changes no operational field, so restoring returns exactly
 * the report that left.
 *
 * SUPER_ADMIN only. Archiving is records governance, not part of the response
 * workflow the operations clerks run — a clerk triages and resolves, and cannot
 * make a report disappear.
 *
 * POST /incident-reports/{id}/archive   (super admin)
 * POST /incident-reports/{id}/restore   (super admin)
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

  const report = await IncidentReport.findOne(buildIdOrCustomIdQuery(id, 'incidentId'));
  if (!report) {
    throw notFoundError('Incident report not found.');
  }

  // Idempotent on purpose: archiving an already-archived report must not append
  // a second history entry or re-stamp the actor.
  if (!report.isArchived) {
    const reason = readReason(event);
    const actor = await actorIdentity(auth);
    const stamp = new Date();

    report.isArchived = true;
    report.archivedAt = stamp;
    report.archivedBy = auth.admin?.adminId;
    report.archivedReason = reason;

    // History is append-only: archiving records a NEW entry rather than
    // rewriting the status it was archived from, so the operational trail stays
    // truthful and the archive action stays attributable.
    if (!Array.isArray(report.timeline)) report.timeline = [];
    report.timeline.push({
      step: 'Archived',
      date: stamp,
      status: 'Archived',
      remarks: reason,
      changedBy: actor ?? undefined,
    });

    // `remarks` mirrors the newest note. Only a supplied reason moves it —
    // otherwise the last operational remark would be erased by the very action
    // that is supposed to preserve the record.
    if (reason) report.remarks = reason;

    await report.save();

    // The report leaves the queue, so its unread bell rows must not outlive the
    // row: without this the sidebar badge keeps counting an incident nobody can
    // open any more.
    await Notification.updateMany({ referenceUrlId: report.incidentId }, { isRead: true });
  }

  return ok(report.toObject(), 'Incident report archived.');
}

async function restore(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  requireSuperAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const report = await IncidentReport.findOne(buildIdOrCustomIdQuery(id, 'incidentId'));
  if (!report) {
    throw notFoundError('Incident report not found.');
  }

  if (report.isArchived) {
    const actor = await actorIdentity(auth);

    report.isArchived = false;
    report.archivedAt = undefined;
    report.archivedBy = undefined;
    report.archivedReason = undefined;

    if (!Array.isArray(report.timeline)) report.timeline = [];
    report.timeline.push({
      step: 'Restored',
      date: new Date(),
      status: 'Restored',
      changedBy: actor ?? undefined,
    });

    await report.save();
  }

  return ok(report.toObject(), 'Incident report restored.');
}

// Both routes point at the WRAPPED exports. Registering the raw functions in
// `serverless.yml` would let a thrown AppError escape `withErrorHandling`, so a
// non-super admin's 403 would surface as an opaque 502 instead.
export const archiveHandler = withErrorHandling(archive);
export const restoreHandler = withErrorHandling(restore);
