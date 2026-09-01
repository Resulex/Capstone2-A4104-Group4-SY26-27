import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError, badRequestError } from '../../../shared/errors';
import { DocumentRequest, Resident } from '../../../models';
import {
  getAuthContext,
  assertOwnResidentRef,
} from '../../../shared/authorization';
import { ensureResidentForUser } from '../../../shared/residents';

interface CreateDocumentRequestBody {
  requestId?: string;
  residentId?: string;
  documentType?: string;
  purpose?: string;
  verificationIdUrl?: string;
  expectedCompletionDate?: string;
}

/**
 * Document Requests — Create
 * Use-case: create a document request. Residents create requests for
 * themselves; staff/admin may create for any resident.
 * POST /document-requests (authenticated)
 */
export async function createDocumentRequest(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const body = parseBody(event) as CreateDocumentRequestBody;

  const { requestId, documentType, purpose, expectedCompletionDate } = body;

  // The request owner is derived from the authenticated caller for residents —
  // their JWT `sub` is their Resident `_id`, so the client never needs to send
  // a `residentId`. Staff/admin may still supply an explicit `residentId` to
  // create a request on a resident's behalf.
  const effectiveResidentId =
    auth.role === 'resident' ? auth.userId : body.residentId;

  if (!requestId || !effectiveResidentId || !documentType || !purpose || !expectedCompletionDate) {
    return badRequest(
      'requestId, residentId, documentType, purpose, and expectedCompletionDate are required.'
    );
  }

  // Defense-in-depth: residents can only create requests for themselves.
  assertOwnResidentRef(auth, effectiveResidentId);

  await connectToDatabase();

  const existing = await DocumentRequest.findOne({ requestId });
  if (existing) {
    throw conflictError('A document request with this requestId already exists.');
  }

  // A resident caller always has a Resident (auto-provisioned if missing);
  // staff/admin must supply a valid residentId.
  const resident =
    auth.role === 'resident'
      ? await ensureResidentForUser(effectiveResidentId)
      : await Resident.findOne({
          $or: [{ _id: effectiveResidentId }, { residentId: effectiveResidentId }],
        });
  if (!resident) {
    throw badRequestError('Invalid residentId.');
  }

  const request = await DocumentRequest.create({
    requestId,
    residentId: resident._id,
    applicantDetails: {
      fullName: [resident.firstName, resident.middleName, resident.lastName, resident.suffix]
        .filter(Boolean)
        .join(' '),
      contactNumber: resident.contactNumber,
      emailAddress: resident.emailAddress,
    },
    documentType,
    purpose,
    verificationIdUrl: body.verificationIdUrl || undefined,
    currentStatus: 'Submitted',
    expectedCompletionDate: new Date(expectedCompletionDate),
    timeline: [
      {
        step: 'Submitted',
        date: new Date(),
        status: 'completed',
      },
    ],
    paymentStatus: 'Unpaid',
    dateRequested: new Date(),
  });

  return created(request.toObject(), 'Document request created.');
}

export const handler = withErrorHandling(createDocumentRequest);