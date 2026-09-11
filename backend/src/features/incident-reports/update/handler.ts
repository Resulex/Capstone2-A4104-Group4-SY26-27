import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { badRequestError, notFoundError } from '../../../shared/errors';
import { IncidentReport } from '../../../models';
import {
  residentFullName,
  notifyAllActiveAdmins,
  sendResidentNotification,
} from '../../../shared/notifications';
import {
  getAuthContext,
  assertOwnResidentRecord,
  requireStaffOrAdmin,
  actorIdentity,
} from '../../../shared/authorization';

interface UpdateIncidentBody {
  descriptionText?: string;
  locationDetails?: string;
  evidenceMediaUrls?: string[];
  triagePriority?: 'Critical' | 'High' | 'Medium' | 'Low';
  incidentStatus?: 'Pending' | 'Responding' | 'Resolved' | 'Closed' | 'Duplicate';
  /** Admin note recorded with the status change. */
  remarks?: string;
  /** Original report (`INC-...`) when the new status is `Duplicate`. */
  duplicateOfIncidentId?: string;
}

/**
 * Incident Reports — Update
 * Use-case: update an incident report. Residents may edit their own report
 * description; status/triage updates (response handling) require staff/admin.
 * PATCH /incident-reports/{id} (authenticated)
 */
export async function updateIncidentReport(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const report = await IncidentReport.findOne(buildIdOrCustomIdQuery(id, 'incidentId'));
  if (!report) {
    throw notFoundError('Incident report not found.');
  }

  assertOwnResidentRecord(auth, report.residentId);

  let statusChanged = false;

  const body = parseBody(event) as UpdateIncidentBody;

  // Status transitions are response-management (staff/admin). Priority is not
  // manually settable — the triage engine dictates it.
  const staffOnly =
    body.incidentStatus !== undefined ||
    body.remarks !== undefined ||
    body.duplicateOfIncidentId !== undefined;
  if (staffOnly && auth.role === 'resident') {
    requireStaffOrAdmin(auth);
  }

  // The duplicate link only means something together with the Duplicate status.
  if (
    body.duplicateOfIncidentId !== undefined &&
    body.incidentStatus !== 'Duplicate'
  ) {
    throw badRequestError(
      'duplicateOfIncidentId may only be sent together with the Duplicate status.'
    );
  }

  const remark = body.remarks?.trim();

  // Resolved once: the acting admin is needed for the timeline entry AND to keep
  // their own status change out of their own notification feed.
  const actor =
    body.incidentStatus !== undefined ? await actorIdentity(auth) : null;

  if (body.descriptionText !== undefined) report.descriptionText = body.descriptionText;
  if (body.locationDetails !== undefined) report.locationDetails = body.locationDetails;
  if (body.evidenceMediaUrls !== undefined) report.evidenceMediaUrls = body.evidenceMediaUrls;

  if (body.incidentStatus !== undefined) {
    const nextStatus = body.incidentStatus;
    let duplicateOf: string | undefined;

    // Terminal decisions must be explained, and a duplicate must also name the
    // report it repeats.
    if (nextStatus === 'Closed' && !remark) {
      throw badRequestError('Remarks are required when closing an incident report.');
    }
    if (nextStatus === 'Duplicate') {
      if (!remark) {
        throw badRequestError(
          'Remarks are required when marking an incident report as a duplicate.'
        );
      }
      const target = body.duplicateOfIncidentId?.trim();
      if (!target) {
        throw badRequestError(
          'The original incident is required when marking a report as a duplicate.'
        );
      }
      if (target === report.incidentId) {
        throw badRequestError('An incident report cannot be a duplicate of itself.');
      }
      const original = await IncidentReport.findOne({ incidentId: target })
        .select('_id')
        .lean();
      if (!original) {
        throw badRequestError('The referenced incident report does not exist.');
      }
      duplicateOf = target;
    }

    const changed = report.incidentStatus !== nextStatus;
    if (!Array.isArray(report.timeline)) report.timeline = [];

    if (changed) {
      statusChanged = true;
      // Record the transition so residents can follow the report's progress.
      report.timeline.push({
        step: nextStatus,
        date: new Date(),
        status: 'completed',
        remarks: remark || undefined,
        changedBy: actor ?? undefined,
        duplicateOfIncidentId: duplicateOf,
      });
      report.remarks = remark || undefined;
      // The link is only meaningful while the report is marked as a duplicate.
      report.duplicateOfIncidentId = duplicateOf;
    } else if (remark !== undefined) {
      // Same status resubmitted with a note: only the latest-remark field
      // moves — history is append-only and never rewritten.
      report.remarks = remark || undefined;
    }

    report.incidentStatus = nextStatus;
  } else if (body.remarks !== undefined) {
    // Note-only edit (no status transition) — update the latest remark only.
    report.remarks = remark || undefined;
  }

  await report.save();

  // Notify the admins (and the reporting resident) when the status changed.
  if (statusChanged) {
    const name = await residentFullName(String(report.residentId));
    const duplicateNote = report.duplicateOfIncidentId
      ? ` (duplicate of ${report.duplicateOfIncidentId})`
      : '';
    const remarkNote = report.remarks ? ` — "${report.remarks}"` : '';

    await notifyAllActiveAdmins(
      {
        category: 'incidentAlert',
        titleText: 'Incident Report Updated',
        messageBody: `${name} updated incident report ${report.incidentId}: ${report.incidentStatus}${duplicateNote}${remarkNote}`,
        referenceUrlId: report.incidentId,
      },
      { excludeAdminId: actor?.userId }
    );

    await sendResidentNotification({
      recipientId: String(report.residentId),
      category: 'incidentAlert',
      titleText: 'Incident Report Updated',
      messageBody: `Your incident report ${report.incidentId} is now ${report.incidentStatus}${duplicateNote}${remarkNote}`,
      referenceUrlId: report.incidentId,
    });
  }

  return ok(report.toObject(), 'Incident report updated.');
}

export const handler = withErrorHandling(updateIncidentReport);