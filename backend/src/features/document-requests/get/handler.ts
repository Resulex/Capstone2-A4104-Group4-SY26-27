import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { DocumentRequest } from '../../../models';
import {
  getAuthContext,
  assertOwnResidentRecord,
} from '../../../shared/authorization';

/**
 * Document Requests — Get
 * Use-case: fetch a single document request. Residents see only their own.
 * GET /document-requests/{id} (authenticated)
 */
export async function getDocumentRequest(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const request = await DocumentRequest.findOne({
    $or: [{ _id: id }, { requestId: id }],
  });
  if (!request) {
    throw notFoundError('Document request not found.');
  }

  assertOwnResidentRecord(auth, request.residentId);
  return ok(request.toObject(), 'Document request fetched.');
}

export const handler = withErrorHandling(getDocumentRequest);