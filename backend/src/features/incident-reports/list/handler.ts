import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { IncidentReport } from '../../../models';
import { getAuthContext, residentRecordScopeFilter } from '../../../shared/authorization';

/**
 * Incident Reports — List
 * Use-case: list incident reports. Residents see only their own; staff/admin
 * see all.
 * GET /incident-reports (authenticated)
 */
export async function listIncidentReports(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  await connectToDatabase();

  // Residents are scoped to their own reports, minus anything that predates a
  // resident-initiated account deletion (see `residentRecordScopeFilter`).
  const query = await residentRecordScopeFilter(auth);

  const reports = await IncidentReport.find(query).lean();
  return ok(reports, 'Incident reports fetched.');
}

export const handler = withErrorHandling(listIncidentReports);