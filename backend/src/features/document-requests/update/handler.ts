import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { notFoundError } from '../../../shared/errors';
import { DocumentRequest, Admin } from '../../../models';
import {
  getAuthContext,
  assertOwnResidentRecord,
  resolveAuthContext,
  requireStaffOrAdmin,
} from '../../../shared/authorization';

interface UpdateDocumentRequestBody {
  purpose?: string;
  verificationIdUrl?: string;
  currentStatus?: 'Submitted' | 'Processing' | 'Ready for Pickup' | 'Released' | 'Rejected';
  expectedCompletionDate?: string;
  timeline?: Array<{ step: string; date: string; status: string }>;
  paymentStatus?: 'Unpaid' | 'Paid Offline';
  officialReceiptNumber?: string;
}

/**
 * Document Requests — Update
 * Use-case: update a document request. Residents may edit their own request
 * metadata; status/payment changes (staff validation) require staff/admin.
 * PATCH /document-requests/{id} (authenticated)
 */
export async function updateDocumentRequest(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = await resolveAuthContext(event);
  const id = parsePathParam(event, 'id');

  await connectToDatabase();

  const request = await DocumentRequest.findOne(buildIdOrCustomIdQuery(id, 'requestId'));
  if (!request) {
    throw notFoundError('Document request not found.');
  }

  assertOwnResidentRecord(auth, request.residentId);

  const body = parseBody(event) as UpdateDocumentRequestBody;

  // Status/payment transitions are staff/admin responsibilities.
  const staffOnly =
    body.currentStatus !== undefined ||
    body.paymentStatus !== undefined ||
    body.officialReceiptNumber !== undefined;
  if (staffOnly && auth.role === 'resident') {
    requireStaffOrAdmin(auth);
  }

  if (body.purpose !== undefined) request.purpose = body.purpose;
  if (body.verificationIdUrl !== undefined) request.verificationIdUrl = body.verificationIdUrl;
  if (body.expectedCompletionDate !== undefined) {
    request.expectedCompletionDate = new Date(body.expectedCompletionDate);
  }
  if (body.timeline !== undefined) {
    request.timeline = body.timeline.map((t) => ({
      step: t.step,
      date: new Date(t.date),
      status: t.status,
    }));
  }
  if (body.currentStatus !== undefined) request.currentStatus = body.currentStatus;
  if (body.paymentStatus !== undefined) request.paymentStatus = body.paymentStatus;
  if (body.officialReceiptNumber !== undefined) {
    request.officialReceiptNumber = body.officialReceiptNumber;
    // Track the verifying admin (by _id) and time when an OR is set.
    if (auth.role === 'admin') {
      const adminDoc = await Admin.findOne({ adminId: auth.userId });
      if (adminDoc) request.verifiedBy = adminDoc._id;
    }
    request.verifiedAt = new Date();
  }

  await request.save();
  return ok(request.toObject(), 'Document request updated.');
}

export const handler = withErrorHandling(updateDocumentRequest);