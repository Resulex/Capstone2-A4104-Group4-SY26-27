import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError } from '../../../shared/errors';
import { User } from '../../../models';
import { hashPassword } from '../../../shared/password';

interface RegisterBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  barangayId?: string;
}

/**
 * Auth — Register
 * Use-case: create a new user account.
 *
 * POST /auth/register
 * Body: { firstName, lastName, email, password, barangayId }
 */
export async function register(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as RegisterBody;

  const { firstName, lastName, email, password, barangayId } = body;

  // Minimal validation.
  if (!firstName || !lastName || !email || !password || !barangayId) {
    return badRequest(
      'firstName, lastName, email, password, and barangayId are required.'
    );
  }

  await connectToDatabase();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw conflictError('An account with this email already exists.');
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    passwordHash,
    barangay: barangayId,
  });

  return created(user.toPublicJSON(), 'Account created.');
}

export const handler = withErrorHandling(register);