import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { Official } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

interface UpdateOfficialBody {
  fullName?: string;
  designatedPosition?: string;
  contactNumber?: string;
  emailAddress?: string;
  officeLocation?: string;
  coreResponsibilities?: string[];
  profileImageUrl?: string;
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
  if (body.contactNumber !== undefined) official.contactNumber = body.contactNumber;
  if (body.emailAddress !== undefined) official.emailAddress = body.emailAddress.toLowerCase();
  if (body.officeLocation !== undefined) official.officeLocation = body.officeLocation;
  if (body.coreResponsibilities !== undefined) official.coreResponsibilities = body.coreResponsibilities;
  if (body.profileImageUrl !== undefined) official.profileImageUrl = body.profileImageUrl;
  if (body.isDeleted !== undefined) official.isDeleted = body.isDeleted;

  await official.save();
  return ok(official.toObject(), 'Official updated.');
}

export const handler = withErrorHandling(updateOfficial);