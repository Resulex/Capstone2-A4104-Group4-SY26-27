import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { DocumentRequest } from '../../../models';
import { getAuthContext, residentScopeFilter } from '../../../shared/authorization';

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

  const query: Record<string, unknown> = {};
  if (auth.role === 'resident') {
    Object.assign(query, residentScopeFilter(auth));
  }

  const requests = await DocumentRequest.find(query).lean();
  return ok(requests, 'Document requests fetched.');
}

export const handler = withErrorHandling(listDocumentRequests);