import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError, badRequestError } from '../../../shared/errors';
import { Official } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';
import {
  contactNumberViolation,
  normalizeContactNumber,
} from '../../../shared/contact-number';

interface UpdateOfficialBody {
  fullName?: string;
  designatedPosition?: string;
  contactNumber?: string;
  emailAddress?: string;
  officeLocation?: string;
  coreResponsibilities?: string[];
  profileImageUrl?: string;
  /**
   * No longer writable here. Archiving moved to `POST /officials/{id}/archive`
   * so it can be gated to SUPER_ADMIN and attributed. Declared so the request
   * fails with a clear 400 rather than being silently dropped.
   */
  isDeleted?: boolean;
}

/**
 * Officials — Update
 * Use-case: update an official record. Staff/admin only.
 * PATCH /officials/{id} (staff or admin)
 */
export async function updateOfficial(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  const id = parsePathParam(event, 'id');
  await connectToDatabase();

  const official = await Official.findOne(buildIdOrCustomIdQuery(id, 'officialId'));
  if (!official) {
    throw notFoundError('Official not found.');
  }

  const body = parseBody(event) as UpdateOfficialBody;

  if (body.fullName !== undefined) official.fullName = body.fullName;
  if (body.designatedPosition !== undefined) official.designatedPosition = body.designatedPosition;
  if (body.contactNumber !== undefined) {
    const contactProblem = contactNumberViolation(body.contactNumber, { required: true });
    if (contactProblem) {
      throw badRequestError(contactProblem);
    }
    official.contactNumber = normalizeContactNumber(body.contactNumber);
  }
  if (body.emailAddress !== undefined) official.emailAddress = body.emailAddress.toLowerCase();
  if (body.officeLocation !== undefined) official.officeLocation = body.officeLocation;
  if (body.coreResponsibilities !== undefined) official.coreResponsibilities = body.coreResponsibilities;
  if (body.profileImageUrl !== undefined) official.profileImageUrl = body.profileImageUrl;

  // Archiving moved to `POST /officials/{id}/archive` (SUPER_ADMIN only) so the
  // action is attributable — the old inline write recorded neither an actor nor
  // a date. Rejected rather than ignored, for the reason given in the residents
  // update handler.
  if (body.isDeleted !== undefined) {
    throw badRequestError(
      'Use POST /officials/{id}/archive to archive an official (super admin only).'
    );
  }

  await official.save();
  return ok(official.toObject(), 'Official updated.');
}

export const handler = withErrorHandling(updateOfficial);