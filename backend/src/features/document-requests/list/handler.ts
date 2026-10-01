import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { DocumentRequest } from '../../../models';
import { resolveAuthContext, residentRecordScopeFilter } from '../../../shared/authorization';
import { archiveScopeFilter } from '../../../shared/archive';

/**
 * Document Requests — List
 * Use-case: list document requests. Residents see only their own; staff/admin
 * see all. Archived requests are excluded unless a SUPER_ADMIN asks for
 * `?scope=archived`.
 * GET /document-requests?scope=active|archived (authenticated)
 */
export async function listDocumentRequests(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  // `resolveAuthContext` (not `getAuthContext`): the archived scope needs the
  // admin's `assignedRole`, which only the loaded Admin document carries.
  const auth = await resolveAuthContext(event);
  await connectToDatabase();

  // Residents are scoped to their own records, minus anything that predates a
  // resident-initiated account deletion (see `residentRecordScopeFilter`).
  // Admins/officials get an empty scope filter, i.e. everything.
  const query = {
    ...(await residentRecordScopeFilter(auth)),
    // Archived requests are hidden from EVERY default list — including the
    // applicant's own — and only a SUPER_ADMIN can ask for the archived slice.
    ...archiveScopeFilter(event, auth),
  };

  const requests = await DocumentRequest.find(query).lean();
  return ok(requests, 'Document requests fetched.');
}

export const handler = withErrorHandling(listDocumentRequests);