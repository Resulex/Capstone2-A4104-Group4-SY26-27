import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Barangay } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Barangays — Get
 * Use-case: fetch a single barangay. Any authenticated user may read.
 * GET /barangays/{id} (authenticated)
 */
export async function getBarangay(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const barangay = await Barangay.findById(id);
  if (!barangay) {
    throw notFoundError('Barangay not found.');
  }

  return ok(barangay.toObject(), 'Barangay fetched.');
}

export const handler = withErrorHandling(getBarangay);