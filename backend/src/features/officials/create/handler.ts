import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError } from '../../../shared/errors';
import { Official } from '../../../models';
import { getAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';

interface CreateOfficialBody {
  officialId?: string;
  fullName?: string;
  designatedPosition?: string;
  contactNumber?: string;
  emailAddress?: string;
  officeLocation?: string;
  coreResponsibilities?: string[];
  profileImageUrl?: string;
}

/**
 * Officials — Create
 * Use-case: create an official directory record. Staff/admin only.
 * POST /officials (staff or admin)
 */
export async function createOfficial(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireStaffOrAdmin(auth);

  const body = parseBody(event) as CreateOfficialBody;
  const { officialId, fullName, designatedPosition, contactNumber, emailAddress, officeLocation } = body;

  if (!officialId || !fullName || !designatedPosition || !contactNumber || !emailAddress || !officeLocation) {
    return badRequest(
      'officialId, fullName, designatedPosition, contactNumber, emailAddress, and officeLocation are required.'
    );
  }

  await connectToDatabase();

  const existing = await Official.findOne({
    $or: [{ officialId }, { emailAddress: emailAddress.toLowerCase() }],
  });
  if (existing) {
    throw conflictError('An official with this officialId or email already exists.');
  }

  const official = await Official.create({
    officialId,
    fullName,
    designatedPosition,
    contactNumber,
    emailAddress: emailAddress.toLowerCase(),
    officeLocation,
    coreResponsibilities: body.coreResponsibilities || [],
    profileImageUrl: body.profileImageUrl || undefined,
    isDeleted: false,
  });

  return created(official.toObject(), 'Official created.');
}

export const handler = withErrorHandling(createOfficial);