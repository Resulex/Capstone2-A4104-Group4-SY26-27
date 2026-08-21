import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError, badRequestError, forbiddenError } from '../../../shared/errors';
import { hashPassword } from '../../../shared/password';
import { User, Barangay } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

interface CreateUserBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: 'resident' | 'official' | 'admin';
  barangayId?: string;
  isActive?: boolean;
}

/**
 * Users — Create
 * Use-case: create a user account. Staff/admin only. Admins may create other
 * admins; officials may only create residents/officials (not admins).
 * POST /users (staff or admin)
 */
export async function createUser(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  const body = parseBody(event) as CreateUserBody;
  const { firstName, lastName, email, password, role, barangayId } = body;

  if (!firstName || !lastName || !email || !password || !role || !barangayId) {
    return badRequest(
      'firstName, lastName, email, password, role, and barangayId are required.'
    );
  }

  // Only admins may create admin-role users.
  if (role === 'admin' && auth.role !== 'admin') {
    throw forbiddenError('Only administrators may create admin accounts.');
  }

  await connectToDatabase();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw conflictError('A user with this email already exists.');
  }

  const barangay = await Barangay.findById(barangayId);
  if (!barangay) {
    throw badRequestError('Invalid barangayId.');
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone: body.phone || undefined,
    passwordHash,
    role,
    barangay: barangay._id,
    isActive: body.isActive ?? true,
  });

  return created(user.toPublicJSON(), 'User created.');
}

export const handler = withErrorHandling(createUser);