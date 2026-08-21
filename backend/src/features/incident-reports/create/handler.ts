import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError, badRequestError } from '../../../shared/errors';
import { IncidentReport, Resident } from '../../../models';
import {
  getAuthContext,
  assertOwnResidentRef,
} from '../../../shared/authorization';

interface CreateIncidentBody {
  incidentId?: string;
  residentId?: string;
  incidentCategory?:
    | 'Fire'
    | 'Flood'
    | 'Medical Emergency'
    | 'Criminal Activity'
    | 'Road Accident'
    | 'Domestic Dispute'
    | 'Infrastructure Damage'
    | 'Public Disturbance'
    | 'Other';
  descriptionText?: string;
  locationDetails?: string;
  evidenceMediaUrls?: string[];
  incidentStatus?: 'Pending' | 'Responding' | 'Resolved' | 'Closed';
}

/**
 * Incident Reports — Create
 * Use-case: create an incident report. Residents report their own incidents;
 * staff/admin may create for any resident.
 * POST /incident-reports (authenticated)
 */
export async function createIncidentReport(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const body = parseBody(event) as CreateIncidentBody;

  const { incidentId, residentId, incidentCategory, descriptionText, locationDetails } = body;

  if (!incidentId || !residentId || !incidentCategory || !descriptionText || !locationDetails) {
    return badRequest(
      'incidentId, residentId, incidentCategory, descriptionText, and locationDetails are required.'
    );
  }

  // Residents may only report incidents for themselves.
  assertOwnResidentRef(auth, residentId);

  await connectToDatabase();

  const existing = await IncidentReport.findOne({ incidentId });
  if (existing) {
    throw conflictError('An incident report with this incidentId already exists.');
  }

  const resident = await Resident.findOne({
    $or: [{ _id: residentId }, { residentId }],
  });
  if (!resident) {
    throw badRequestError('Invalid residentId.');
  }

  const report = await IncidentReport.create({
    incidentId,
    residentId: resident._id,
    incidentCategory,
    descriptionText,
    locationDetails,
    triagePriority: 'Low', // default; Rule-Based Prioritization would compute this
    evidenceMediaUrls: body.evidenceMediaUrls || [],
    incidentStatus: body.incidentStatus || 'Pending',
    reportedAt: new Date(),
  });

  return created(report.toObject(), 'Incident report created.');
}

export const handler = withErrorHandling(createIncidentReport);