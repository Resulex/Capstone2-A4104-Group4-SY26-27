import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { DocumentRequest } from '../../../models';
import { getAuthContext, residentRecordScopeFilter } from '../../../shared/authorization';

/**
 * Document Requests — List
 * Use-case: list document requests. Residents see only their own; staff/admin
 * see all.
 * GET /document-requests (authenticated)
 */
export async function listDocumentRequests(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  await connectToDatabase();

  // Residents are scoped to their own records, minus anything that predates a
  // resident-initiated account deletion (see `residentRecordScopeFilter`).
  // Admins/officials get an empty filter, i.e. everything.
  const query = await residentRecordScopeFilter(auth);

  const requests = await DocumentRequest.find(query).lean();
  return ok(requests, 'Document requests fetched.');
}

export const handler = withErrorHandling(listDocumentRequests);