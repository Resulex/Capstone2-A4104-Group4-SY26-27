import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { badRequestError } from '../../../shared/errors';
import { DocumentRequest, Resident } from '../../../models';
import {
  getAuthContext,
  assertOwnResidentRef,
} from '../../../shared/authorization';
import { ensureResidentForUser } from '../../../shared/residents';
import { residentFullName, notifyAllActiveAdmins } from '../../../shared/notifications';

interface CreateDocumentRequestBody {
  residentId?: string;
  documentType?: string;
  purpose?: string;
  contactNumber?: string;
  emailAddress?: string;
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

  const { documentType, purpose, expectedCompletionDate } = body;

  // The request owner is derived from the caller for self-service creates — a
  // resident's (or official's, acting through the resident portal) JWT `sub` is
  // their own Resident `_id`, so the client never needs to send a `residentId`.
  // Admins creating on a resident's behalf must still supply an explicit
  // `residentId`.
  const effectiveResidentId =
    body.residentId || (auth.role === 'admin' ? undefined : auth.userId);

  if (!effectiveResidentId || !documentType || !purpose || !expectedCompletionDate) {
    return badRequest(
      'residentId, documentType, purpose, and expectedCompletionDate are required.'
    );
  }

  // Defense-in-depth: residents can only create requests for themselves.
  assertOwnResidentRef(auth, effectiveResidentId);

  await connectToDatabase();

  // A resident/official caller always has a Resident (auto-provisioned if
  // missing); an admin must supply a valid residentId.
  const resident =
    auth.role === 'admin'
      ? await Resident.findOne({
          $or: [{ _id: effectiveResidentId }, { residentId: effectiveResidentId }],
        })
      : await ensureResidentForUser(effectiveResidentId);
  if (!resident) {
    throw badRequestError('Invalid residentId.');
  }

  // Server-assigned sequential id: REQ-<year><5-digit sequence>.
  const requestId = await nextRequestId();
  const request = await DocumentRequest.create({
    requestId,
    residentId: resident._id,
    applicantDetails: {
      fullName: [resident.firstName, resident.middleName, resident.lastName, resident.suffix]
        .filter(Boolean)
        .join(' '),
      // Prefer the contact details captured on the request form; fall back to
      // the resident's stored values (or empty strings when unknown) instead
      // of failing the schema's required check.
      contactNumber: body.contactNumber?.trim() || resident.contactNumber || '',
      emailAddress:
        body.emailAddress?.trim().toLowerCase() || resident.emailAddress || '',
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
    dateRequested: new Date(),
  });

  // Notify all active admins of the new request over the real-time channel.
  const name = await residentFullName(String(resident._id));
  await notifyAllActiveAdmins({
    category: 'documentUpdate',
    titleText: 'New Document Request',
    messageBody: `${name} requested a document: ${documentType}`,
    referenceUrlId: requestId,
  });

  return created(request.toObject(), 'Document request created.');
}

/**
 * Builds the next sequential document-request id (REQ-<year><5-digit seq>).
 * The sequence resets each calendar year via the year prefix.
 */
async function nextRequestId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}`;
  const last = await DocumentRequest.findOne({
    requestId: { $regex: `^${prefix}\\d{5}$` },
  })
    .sort({ requestId: -1 })
    .select('requestId')
    .lean();
  const seq = last ? parseInt(last.requestId.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

export const handler = withErrorHandling(createDocumentRequest);