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
 * Document Requests — Delete
 * Use-case: delete a document request. Residents may delete their own; staff
 * and admins may delete any.
 * DELETE /document-requests/{id} (authenticated)
 */
export async function deleteDocumentRequest(
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
  await request.deleteOne();
  return ok({ deleted: request.requestId }, 'Document request deleted.');
}

export const handler = withErrorHandling(deleteDocumentRequest);