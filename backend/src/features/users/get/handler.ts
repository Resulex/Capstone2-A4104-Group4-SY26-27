import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { User } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Users — Get
 * Use-case: fetch a single user. Residents may only view their own record;
 * staff/admins may view any within scope.
 * GET /users/{id} (authenticated)
 */
export async function getUser(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const user = await User.findById(id).select('+passwordHash');
  if (!user) {
    throw notFoundError('User not found.');
  }

  // Residents may only view their own user record.
  if (auth.role === 'resident' && auth.userId !== id) {
    throw notFoundError('User not found.');
  }

  return ok(user.toPublicJSON(), 'User fetched.');
}

export const handler = withErrorHandling(getUser);