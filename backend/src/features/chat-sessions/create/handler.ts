import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody, buildIdOrCustomIdQuery } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { conflictError, badRequestError } from '../../../shared/errors';
import { ChatSession, IncidentReport, Resident, Admin } from '../../../models';
import {
  getAuthContext,
  assertOwnResidentRef,
  requireStaffOrAdmin,
} from '../../../shared/authorization';

interface CreateChatSessionBody {
  sessionId?: string;
  incidentId?: string;
  residentId?: string;
  adminId?: string;
  deviceInfo?: { os?: string; browser?: string; model?: string };
  ipAddress?: string;
}

/**
 * Chat Sessions — Create
 * Use-case: create a chat session for an incident. Only staff/admins may open
 * a conversation (responder-initiated); residents cannot initiate a live chat
 * but can join and message within sessions opened for them.
 * POST /chat-sessions (authenticated)
 */
export async function createChatSession(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);

  // Responder-initiated only: residents are not allowed to open sessions.
  requireStaffOrAdmin(auth);

  const body = parseBody(event) as CreateChatSessionBody;

  const { sessionId, incidentId, residentId, adminId, deviceInfo, ipAddress } = body;

  if (!sessionId || !incidentId || !residentId || !deviceInfo || !ipAddress || !deviceInfo.os || !deviceInfo.browser) {
    return badRequest(
      'sessionId, incidentId, residentId, adminId, deviceInfo (os, browser), and ipAddress are required.'
    );
  }

  // Defense-in-depth: residents may only create sessions for themselves.
  assertOwnResidentRef(auth, residentId);

  await connectToDatabase();

  const existing = await ChatSession.findOne({ sessionId });
  if (existing) {
    throw conflictError('A chat session with this sessionId already exists.');
  }

  const incident = await IncidentReport.findOne(
    buildIdOrCustomIdQuery(incidentId, 'incidentId')
  );
  if (!incident) {
    throw badRequestError('Invalid incidentId.');
  }

  const resident = await Resident.findOne(
    buildIdOrCustomIdQuery(residentId, 'residentId')
  );
  if (!resident) {
    throw badRequestError('Invalid residentId.');
  }

  // Resolve the responder admin. For a resident caller, pick a default admin
  // if none given; admins provide their own adminId.
  let responderAdmin = adminId;
  if (!responderAdmin && auth.role === 'admin') {
    responderAdmin = auth.userId;
  }

  const admin = responderAdmin
    ? await Admin.findOne(
        buildIdOrCustomIdQuery(responderAdmin, 'adminId')
      )
    : null;
  if (!admin) {
    throw badRequestError('Invalid adminId.');
  }

  const session = await ChatSession.create({
    sessionId,
    incidentId: incident._id,
    residentId: resident._id,
    adminId: admin._id,
    isActive: true,
    deviceInfo: {
      os: deviceInfo.os,
      browser: deviceInfo.browser,
      model: deviceInfo.model || '',
    },
    ipAddress,
    messageCount: 0,
    startedAt: new Date(),
    lastActivity: new Date(),
  });

  return created(session.toObject(), 'Chat session created.');
}

export const handler = withErrorHandling(createChatSession);