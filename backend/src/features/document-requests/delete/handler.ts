import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { DocumentRequest } from '../../../models';
import {
  getAuthContext,
  assertOwnResidentRecord,
  assertResidentRecordWritable,
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

  const request = await DocumentRequest.findOne(buildIdOrCustomIdQuery(id, 'requestId'));
  if (!request) {
    throw notFoundError('Document request not found.');
  }

  assertOwnResidentRecord(auth, request.residentId);
  // A request filed before the resident deleted their account can no longer be
  // removed by them (staff may still delete it).
  await assertResidentRecordWritable(auth, request);
  await request.deleteOne();
  return ok({ deleted: request.requestId }, 'Document request deleted.');
}

export const handler = withErrorHandling(deleteDocumentRequest);