import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { IncidentReport } from '../../../models';
import { residentFullName, notifyAllActiveAdmins } from '../../../shared/notifications';
import {
  getAuthContext,
  assertOwnResidentRecord,
  requireStaffOrAdmin,
} from '../../../shared/authorization';

interface UpdateIncidentBody {
  descriptionText?: string;
  locationDetails?: string;
  evidenceMediaUrls?: string[];
  triagePriority?: 'Critical' | 'High' | 'Medium' | 'Low';
  incidentStatus?: 'Pending' | 'Responding' | 'Resolved' | 'Closed';
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
  const staffOnly = body.incidentStatus !== undefined;
  if (staffOnly && auth.role === 'resident') {
    requireStaffOrAdmin(auth);
  }

  if (body.descriptionText !== undefined) report.descriptionText = body.descriptionText;
  if (body.locationDetails !== undefined) report.locationDetails = body.locationDetails;
  if (body.evidenceMediaUrls !== undefined) report.evidenceMediaUrls = body.evidenceMediaUrls;
  if (body.incidentStatus !== undefined) {
    statusChanged = statusChanged || report.incidentStatus !== body.incidentStatus;
    report.incidentStatus = body.incidentStatus;
  }

  await report.save();

  // Notify admins when the incident's status/triage actually changed.
  if (statusChanged) {
    const name = await residentFullName(String(report.residentId));
    await notifyAllActiveAdmins({
      category: 'incidentAlert',
      titleText: 'Incident Report Updated',
      messageBody: `${name} updated incident report ${report.incidentId}: ${report.incidentStatus}`,
      referenceUrlId: report.incidentId,
    });
  }

  return ok(report.toObject(), 'Incident report updated.');
}

export const handler = withErrorHandling(updateIncidentReport);