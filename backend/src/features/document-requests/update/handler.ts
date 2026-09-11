import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, parsePathParam, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { badRequestError, notFoundError } from '../../../shared/errors';
import { DocumentRequest } from '../../../models';
import {
  residentFullName,
  notifyAllActiveAdmins,
  sendResidentNotification,
} from '../../../shared/notifications';
import {
  assertOwnResidentRecord,
  resolveAuthContext,
  requireStaffOrAdmin,
  actorIdentity,
} from '../../../shared/authorization';

interface UpdateDocumentRequestBody {
  purpose?: string;
  verificationIdUrl?: string;
  currentStatus?: 'Submitted' | 'Processing' | 'Ready for Pickup' | 'Released' | 'Rejected';
  expectedCompletionDate?: string;
  timeline?: Array<{ step: string; date: string; status: string }>;
  remarks?: string;
}

/**
 * Document Requests — Update
 * Use-case: update a document request. Residents may edit their own request
 * metadata; status changes (staff validation) require staff/admin.
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

  let statusChanged = false;

  const body = parseBody(event) as UpdateDocumentRequestBody;

  // Status transitions are staff/admin responsibilities.
  const staffOnly =
    body.currentStatus !== undefined || body.remarks !== undefined;
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
  const remark = body.remarks?.trim();

  if (body.currentStatus !== undefined) {
    // Rejecting a request requires a remark explaining the decision.
    if (body.currentStatus === 'Rejected' && !remark) {
      throw badRequestError('Remarks are required when rejecting a document request.');
    }
    const changed = request.currentStatus !== body.currentStatus;
    request.currentStatus = body.currentStatus;
    statusChanged = changed;
    if (!Array.isArray(request.timeline)) request.timeline = [];
    if (changed) {
      // Record the reached status in the resident-visible progress timeline,
      // together with the note and the officer who made the decision.
      request.timeline.push({
        step: body.currentStatus,
        date: new Date(),
        status: 'completed',
        remarks: remark || undefined,
        changedBy: (await actorIdentity(auth)) ?? undefined,
      });
      request.remarks = remark || undefined;
    } else if (remark !== undefined) {
      // Same status resubmitted with a note: only the latest-remark field
      // moves — history is append-only and never rewritten.
      request.remarks = remark || undefined;
    }
  } else if (body.remarks !== undefined) {
    // Note-only edit (no status transition) — update the latest remark only.
    request.remarks = remark || undefined;
  }

  await request.save();

  // Notify admins (and the requesting resident) when the status actually changed.
  if (statusChanged) {
    const name = await residentFullName(String(request.residentId));
    const remarkNote = request.remarks ? ` — "${request.remarks}"` : '';

    await notifyAllActiveAdmins({
      category: 'documentUpdate',
      titleText: 'Document Request Updated',
      messageBody: `${name}'s document request ${request.requestId} is now ${request.currentStatus}${remarkNote}`,
      referenceUrlId: request.requestId,
    });

    await sendResidentNotification({
      recipientId: String(request.residentId),
      category: 'documentUpdate',
      titleText: 'Document Request Updated',
      messageBody: `Your document request ${request.requestId} is now ${request.currentStatus}${remarkNote}`,
      referenceUrlId: request.requestId,
    });
  }

  return ok(request.toObject(), 'Document request updated.');
}

export const handler = withErrorHandling(updateDocumentRequest);