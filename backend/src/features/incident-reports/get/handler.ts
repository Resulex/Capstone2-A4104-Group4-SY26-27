import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { IncidentReport } from '../../../models';
import {
  getAuthContext,
  assertOwnResidentRecord,
} from '../../../shared/authorization';

/**
 * Incident Reports — Get
 * Use-case: fetch a single incident report. Residents see only their own.
 * GET /incident-reports/{id} (authenticated)
 */
export async function getIncidentReport(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const report = await IncidentReport.findOne({
    $or: [{ _id: id }, { incidentId: id }],
  });
  if (!report) {
    throw notFoundError('Incident report not found.');
  }

  assertOwnResidentRecord(auth, report.residentId);
  return ok(report.toObject(), 'Incident report fetched.');
}

export const handler = withErrorHandling(getIncidentReport);