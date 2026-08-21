import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { unauthorizedError } from '../../../shared/errors';
import { User } from '../../../models';
import { comparePassword } from '../../../shared/password';
import { signToken } from '../../../shared/auth';

interface LoginBody {
  email?: string;
  password?: string;
}

/**
 * Auth — Login
 * Use-case: authenticate a user and return a JWT.
 *
 * POST /auth/login
 * Body: { email, password }
 */
export async function login(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as LoginBody;
  const { email, password } = body;

  if (!email || !password) {
    throw unauthorizedError('Email and password are required.');
  }

  await connectToDatabase();

  // passwordHash has `select: false`, so select it explicitly here.
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

  if (!user) {
    throw unauthorizedError('Invalid credentials.');
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw unauthorizedError('Invalid credentials.');
  }

  const token = signToken(user.id, user.role);

  return ok(
    { token, user: user.toPublicJSON() },
    'Login successful.'
  );
}

export const handler = withErrorHandling(login);