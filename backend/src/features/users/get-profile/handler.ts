import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { User } from '../../../models';

/**
 * Users — Get Profile
 * Use-case: fetch the authenticated user's own profile.
 *
 * GET /users/me  (protected by the auth-jwt authorizer)
 *
 * The authorizer places the authenticated user's id in
 * `event.requestContext.authorizer.userId`.
 */
export async function getProfile(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const userId =
    event.requestContext.authorizer?.userId ??
    event.requestContext.authorizer?.principalId;

  if (!userId) {
    throw notFoundError('Authenticated user not found.');
  }

  await connectToDatabase();

  const user = await User.findById(userId);
  if (!user) {
    throw notFoundError('User not found.');
  }

  return ok(user.toPublicJSON(), 'Profile fetched.');
}

export const handler = withErrorHandling(getProfile);