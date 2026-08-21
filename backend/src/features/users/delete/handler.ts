import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { User } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

/**
 * Users — Delete
 * Use-case: delete a user account. Residents may delete only their own;
 * staff/admin may delete any in scope. Admin protection: an admin cannot
 * delete their own account via this route.
 * DELETE /users/{id} (authenticated)
 */
export async function deleteUser(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const user = await User.findById(id);
  if (!user) {
    throw notFoundError('User not found.');
  }

  if (auth.role === 'resident') {
    // Residents may only delete their own record.
    if (auth.userId !== id) {
      throw notFoundError('User not found.');
    }
  } else {
    requireStaffOrAdmin(auth);
  }

  await user.deleteOne();
  return ok({ deleted: String(user._id) }, 'User deleted.');
}

export const handler = withErrorHandling(deleteUser);