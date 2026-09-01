import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Official } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Officials — Get
 * Use-case: fetch a single official. Any authenticated user may read.
 * GET /officials/{id} (authenticated)
 */
export async function getOfficial(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const official = await Official.findOne({
    ...buildIdOrCustomIdQuery(id, 'officialId'),
    isDeleted: false,
  });
  if (!official) {
    throw notFoundError('Official not found.');
  }

  return ok(official.toObject(), 'Official fetched.');
}

export const handler = withErrorHandling(getOfficial);