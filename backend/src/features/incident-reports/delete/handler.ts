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
 * Incident Reports — Delete
 * Use-case: delete an incident report. Residents may delete their own;
 * staff/admins may delete any.
 * DELETE /incident-reports/{id} (authenticated)
 */
export async function deleteIncidentReport(
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
  await report.deleteOne();
  return ok({ deleted: report.incidentId }, 'Incident report deleted.');
}

export const handler = withErrorHandling(deleteIncidentReport);