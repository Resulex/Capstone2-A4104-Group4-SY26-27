import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { unauthorizedError } from '../../../shared/errors';
import { Resident, User } from '../../../models';
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
 * `email` may be an email address or a mobile number (registered users store
 * both on the User record).
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
  // The identifier may be an email address or a mobile number.
  const user = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { contactNumber: email }],
  }).select('+passwordHash');

  if (!user) {
    throw unauthorizedError('Invalid credentials.');
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw unauthorizedError('Invalid credentials.');
  }

  const token = signToken(user.id, user.role);

  // Password-registered residents have a linked Resident sharing the User's
  // `_id`; return it so the frontend can populate the full resident profile.
  const resident = await Resident.findById(user.id).select('+passwordHash');

  return ok(
    {
      token,
      user: user.toPublicJSON(),
      resident: resident ? resident.toPublicJSON() : undefined,
    },
    'Login successful.'
  );
}

export const handler = withErrorHandling(login);