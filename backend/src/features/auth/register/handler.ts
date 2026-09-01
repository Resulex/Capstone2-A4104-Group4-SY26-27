import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError } from '../../../shared/errors';
import { Barangay, Resident, User } from '../../../models';
import { hashPassword } from '../../../shared/password';

interface RegisterBody {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  suffix?: string;
  email?: string;
  contactNumber?: string;
  password?: string;
  barangayId?: string;
  houseUnitNumber?: string;
  streetPurokName?: string;
}

/**
 * Auth — Register
 * Use-case: create a new user account.
 *
 * POST /auth/register
 * Body: { firstName, lastName, middleName?, suffix?, email, contactNumber?,
 *         password, barangayId, houseUnitNumber?, streetPurokName? }
 */
export async function register(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as RegisterBody;

  const {
    firstName,
    lastName,
    middleName,
    suffix,
    email,
    contactNumber,
    password,
    barangayId,
    houseUnitNumber,
    streetPurokName,
  } = body;

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

  // A Resident may already exist for this email (e.g. admin-created). The
  // self-service signup links User and Resident by sharing the same `_id`, so
  // an existing Resident cannot be reused — reject instead of conflicting.
  const existingResident = await Resident.findOne({
    emailAddress: email.toLowerCase(),
  });
  if (existingResident) {
    throw conflictError('An account with this email already exists.');
  }

  const barangay = await Barangay.findById(barangayId);
  if (!barangay) {
    return badRequest('Invalid barangayId.');
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    firstName,
    lastName,
    middleName: middleName || undefined,
    suffix: suffix || undefined,
    email: email.toLowerCase(),
    contactNumber: contactNumber || undefined,
    passwordHash,
    barangay: barangay._id,
    // Denormalized read-only address, sourced from the barangay.
    city: barangay.city,
    province: barangay.province,
    zipCode: barangay.zipCode,
    houseUnitNumber: houseUnitNumber || undefined,
    streetPurokName: streetPurokName || undefined,
  });

  // Create a linked Resident sharing the User's `_id`. Resident-owned records
  // are scoped by `residentId = User._id` (the JWT `sub`), so the Resident
  // must use the same id for the resident dashboard to resolve the account
  // after login.
  await Resident.create({
    _id: user._id,
    firstName,
    lastName,
    middleName: middleName || undefined,
    suffix: suffix || undefined,
    emailAddress: email.toLowerCase(),
    contactNumber: contactNumber || undefined,
    houseUnitNumber: houseUnitNumber || undefined,
    streetPurokName: streetPurokName || undefined,
    barangay: barangay._id,
    city: barangay.city,
    province: barangay.province,
    zipCode: barangay.zipCode,
    passwordHash,
    accountStatus: 'active',
    isProvisioned: true,
  });

  return created(user.toPublicJSON(), 'Account created.');
}

export const handler = withErrorHandling(register);