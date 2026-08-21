import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Barangay } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Barangays — List
 * Use-case: list barangays. Any authenticated user may read.
 * GET /barangays (authenticated)
 */
export async function listBarangays(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  getAuthContext(event);
  await connectToDatabase();

  const barangays = await Barangay.find().sort({ name: 1 }).lean();
  return ok(barangays, 'Barangays fetched.');
}

export const handler = withErrorHandling(listBarangays);