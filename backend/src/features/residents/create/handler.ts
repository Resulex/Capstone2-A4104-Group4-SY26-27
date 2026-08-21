import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError, badRequestError } from '../../../shared/errors';
import { hashPassword } from '../../../shared/password';
import { Resident, Barangay } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

interface CreateResidentBody {
  residentId?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  suffix?: string;
  emailAddress?: string;
  contactNumber?: string;
  houseUnitNumber?: string;
  streetPurokName?: string;
  barangayId?: string;
  password?: string;
  profileImageUrl?: string;
  accountStatus?: 'active' | 'suspended';
}

/**
 * Residents — Create
 * Use-case: create a resident account.
 * POST /residents (staff or admin)
 */
export async function createResident(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  const body = parseBody(event) as CreateResidentBody;
  const {
    residentId,
    firstName,
    lastName,
    emailAddress,
    contactNumber,
    houseUnitNumber,
    streetPurokName,
    barangayId,
    password,
  } = body;

  if (
    !residentId ||
    !firstName ||
    !lastName ||
    !emailAddress ||
    !contactNumber ||
    !houseUnitNumber ||
    !streetPurokName ||
    !barangayId ||
    !password
  ) {
    return badRequest(
      'residentId, firstName, lastName, emailAddress, contactNumber, houseUnitNumber, streetPurokName, barangayId, and password are required.'
    );
  }

  await connectToDatabase();

  const existing = await Resident.findOne({
    $or: [{ residentId }, { emailAddress: emailAddress.toLowerCase() }],
  });
  if (existing) {
    throw conflictError('A resident with this residentId or email already exists.');
  }

  const barangay = await Barangay.findById(barangayId);
  if (!barangay) {
    throw badRequestError('Invalid barangayId.');
  }

  const passwordHash = await hashPassword(password);

  const resident = await Resident.create({
    residentId,
    firstName,
    lastName,
    middleName: body.middleName || undefined,
    suffix: body.suffix || undefined,
    emailAddress: emailAddress.toLowerCase(),
    contactNumber,
    houseUnitNumber,
    streetPurokName,
    barangay: barangay._id,
    city: barangay.city,
    province: barangay.province,
    zipCode: barangay.zipCode,
    passwordHash,
    profileImageUrl: body.profileImageUrl || undefined,
    accountStatus: body.accountStatus || 'active',
  });

  return created(resident.toPublicJSON(), 'Resident created.');
}

export const handler = withErrorHandling(createResident);