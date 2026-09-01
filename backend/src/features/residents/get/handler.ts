import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Resident } from '../../../models';
import { getAuthContext, assertResidentOwnership } from '../../../shared/authorization';

/**
 * Residents — Get
 * Use-case: fetch a single resident. Residents may only view their own
 * record; officials/admins may view within their scope.
 * GET /residents/{id} (authenticated)
 */
export async function getResident(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const resident = await Resident.findOne(
    buildIdOrCustomIdQuery(id, 'residentId')
  ).select('+passwordHash');

  if (!resident) {
    throw notFoundError('Resident not found.');
  }

  // Residents may only view their own record.
  if (auth.role === 'resident') {
    assertResidentOwnership(auth, resident.residentId);
  }

  return ok(resident.toPublicJSON(), 'Resident fetched.');
}

export const handler = withErrorHandling(getResident);