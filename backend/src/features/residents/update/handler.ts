import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError, conflictError, badRequestError } from '../../../shared/errors';
import { hashPassword } from '../../../shared/password';
import {
  contactNumberViolation,
  normalizeContactNumber,
} from '../../../shared/contact-number';
import { Resident, Barangay } from '../../../models';
import { getAuthContext, assertResidentOwnership } from '../../../shared/authorization';

interface UpdateResidentBody {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  suffix?: string;
  contactNumber?: string;
  houseUnitNumber?: string;
  streetPurokName?: string;
  barangayId?: string;
  password?: string;
  profileImageUrl?: string;
  accountStatus?: 'active' | 'suspended';
  /** Record Terms + Data Privacy consent (resident self-service only). */
  acceptTerms?: boolean;
  termsVersion?: string;
}

/**
 * Residents — Update
 * Use-case: update a resident. Residents may only update their own record.
 * PATCH /residents/{id} (authenticated)
 */
export async function updateResident(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const resident = await Resident.findOne(buildIdOrCustomIdQuery(id, 'residentId'));
  if (!resident) {
    throw notFoundError('Resident not found.');
  }

  // Residents may only update their own record.
  if (auth.role === 'resident') {
    assertResidentOwnership(auth, resident);
  }

  const body = parseBody(event) as UpdateResidentBody;

  if (body.firstName !== undefined) resident.firstName = body.firstName;
  if (body.lastName !== undefined) resident.lastName = body.lastName;
  if (body.middleName !== undefined) resident.middleName = body.middleName;
  if (body.suffix !== undefined) resident.suffix = body.suffix;
  if (body.contactNumber !== undefined) {
    const contactProblem = contactNumberViolation(body.contactNumber);
    if (contactProblem) {
      throw badRequestError(contactProblem);
    }
    resident.contactNumber = normalizeContactNumber(body.contactNumber);
  }
  if (body.houseUnitNumber !== undefined) resident.houseUnitNumber = body.houseUnitNumber;
  if (body.streetPurokName !== undefined) resident.streetPurokName = body.streetPurokName;
  if (body.profileImageUrl !== undefined) resident.profileImageUrl = body.profileImageUrl;

  // Only staff/admin may change account status.
  if (body.accountStatus !== undefined && auth.role !== 'resident') {
    resident.accountStatus = body.accountStatus;
  }

  // Re-derive read-only address if barangay changes (staff/admin only).
  if (body.barangayId !== undefined && auth.role !== 'resident') {
    const barangay = await Barangay.findById(body.barangayId);
    if (!barangay) {
      throw conflictError('Invalid barangayId.');
    }
    resident.barangay = barangay._id;
    resident.city = barangay.city;
    resident.province = barangay.province;
    resident.zipCode = barangay.zipCode ?? '';
  }

  // Password change hashes the new value.
  if (body.password !== undefined) {
    resident.passwordHash = await hashPassword(body.password);
  }

  // Record Terms + Data Privacy consent. The timestamp is set server-side so
  // the client cannot backdate it; consent is a personal, resident-only action.
  if (body.acceptTerms === true && auth.role === 'resident') {
    resident.termsAcceptedAt = new Date();
    if (body.termsVersion) resident.termsVersion = body.termsVersion;
  }

  await resident.save();
  return ok(resident.toPublicJSON(), 'Resident updated.');
}

export const handler = withErrorHandling(updateResident);