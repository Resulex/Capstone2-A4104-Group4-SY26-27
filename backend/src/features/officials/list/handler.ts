import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Official } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Officials — List
 * Use-case: list officials (directory). Any authenticated user may read.
 * Soft-deleted (archived) officials are excluded.
 * GET /officials (authenticated)
 */
export async function listOfficials(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  getAuthContext(event);
  await connectToDatabase();

  const officials = await Official.find({ isDeleted: false }).lean();
  return ok(officials, 'Officials fetched.');
}

export const handler = withErrorHandling(listOfficials);