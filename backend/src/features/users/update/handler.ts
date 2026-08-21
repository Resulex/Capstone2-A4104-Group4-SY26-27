import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError, forbiddenError } from '../../../shared/errors';
import { hashPassword } from '../../../shared/password';
import { User } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

interface UpdateUserBody {
  firstName?: string;
  lastName?: string;
  phone?: string;
  password?: string;
  role?: 'resident' | 'official' | 'admin';
  isActive?: boolean;
}

/**
 * Users — Update
 * Use-case: update a user. Residents may update their own profile; staff/admin
 * may update users in scope; role changes require admin.
 * PATCH /users/{id} (authenticated)
 */
export async function updateUser(
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

  // Residents may only update their own record.
  if (auth.role === 'resident' && auth.userId !== id) {
    throw notFoundError('User not found.');
  }

  const body = parseBody(event) as UpdateUserBody;

  // Role changes require admin.
  if (body.role !== undefined) {
    if (auth.role !== 'admin') {
      throw forbiddenError('Only administrators may change roles.');
    }
    user.role = body.role;
  }

  if (body.firstName !== undefined) user.firstName = body.firstName;
  if (body.lastName !== undefined) user.lastName = body.lastName;
  if (body.phone !== undefined) user.phone = body.phone;
  if (body.isActive !== undefined && auth.role !== 'resident') {
    user.isActive = body.isActive;
  }
  if (body.password !== undefined) {
    user.passwordHash = await hashPassword(body.password);
  }

  await user.save();
  return ok(user.toPublicJSON(), 'User updated.');
}

export const handler = withErrorHandling(updateUser);