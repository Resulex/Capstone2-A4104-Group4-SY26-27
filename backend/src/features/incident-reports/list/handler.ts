import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { IncidentReport } from '../../../models';
import { resolveAuthContext, residentRecordScopeFilter } from '../../../shared/authorization';
import { archiveScopeFilter } from '../../../shared/archive';

/**
 * Incident Reports — List
 * Use-case: list incident reports. Residents see only their own; staff/admin
 * see all. Archived reports are excluded unless a SUPER_ADMIN asks for
 * `?scope=archived`.
 * GET /incident-reports?scope=active|archived (authenticated)
 */
export async function listIncidentReports(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  // `resolveAuthContext` (not `getAuthContext`): the archived scope needs the
  // admin's `assignedRole`, which only the loaded Admin document carries.
  const auth = await resolveAuthContext(event);
  await connectToDatabase();

  // Residents are scoped to their own reports, minus anything that predates a
  // resident-initiated account deletion (see `residentRecordScopeFilter`).
  const query = {
    ...(await residentRecordScopeFilter(auth)),
    // Archived reports are hidden from EVERY default list — including the
    // reporter's own — and only a SUPER_ADMIN can ask for the archived slice.
    ...archiveScopeFilter(event, auth),
  };

  // Newest first (index-backed by `reportedAt: -1`). Without an explicit sort the
  // response followed Mongo's natural order, which put a freshly filed report
  // last — the resident then had to scroll to find the report they had just
  // submitted. Admins re-sort their own view, so this only fixes the raw order.
  const reports = await IncidentReport.find(query).sort({ reportedAt: -1 }).lean();
  return ok(reports, 'Incident reports fetched.');
}

export const handler = withErrorHandling(listIncidentReports);