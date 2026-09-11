import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { created, badRequest } from '../../../shared/responses';
import { badRequestError } from '../../../shared/errors';
import { IncidentReport, Resident } from '../../../models';
import {
  getAuthContext,
  assertOwnResidentRef,
  actorIdentity,
} from '../../../shared/authorization';
import { ensureResidentForUser } from '../../../shared/residents';
import { residentFullName, notifyAllActiveAdmins } from '../../../shared/notifications';

interface CreateIncidentBody {
  incidentId?: string;
  residentId?: string;
  incidentCategory?:
    | 'Fire'
    | 'Flood'
    | 'Medical Emergency'
    | 'Criminal Activity'
    | 'Road Accident'
    | 'Domestic Dispute'
    | 'Infrastructure Damage'
    | 'Public Disturbance'
    | 'Other';
  descriptionText?: string;
  locationDetails?: string;
  evidenceMediaUrls?: string[];
  incidentStatus?: 'Pending' | 'Responding' | 'Resolved' | 'Closed' | 'Duplicate';
}

/**
 * Rule-based triage: the system derives the severity from the incident
 * category + certain urgency keywords in the description (not chosen by a
 * human). Falls back to 'Low'.
 */
function computeTriagePriority(
  category: string,
  description: string
): 'Critical' | 'High' | 'Medium' | 'Low' {
  // Residents may describe incidents in English or everyday Filipino, so the
  // rules match common terms from both. Word boundaries avoid false-positive
  // substring matches (e.g. "baha" inside "bahagi", "gulo" inside "gulong").
  const text = `${category} ${description}`.toLowerCase();
  if (
    /\b(fire|burning|life|critical|emergency|death|unconscious|sunog|nasusunog|apoy|buhay|patay|kritikal|emerhensiya|walang malay|sakuna)\b/.test(
      text
    )
  ) {
    return 'Critical';
  }
  if (
    /\b(criminal|robbery|assault|stab|shooting|accident|major|severe|krimen|nakawan|saksak|pamamaril|aksidente|seryoso|malala|suntukan)\b/.test(
      text
    )
  ) {
    return 'High';
  }
  if (
    /\b(flood|water|infrastructure|damage|disturbance|injury|baha|tubig|sira|nasira|gulo|pinsala|basag)\b/.test(
      text
    )
  ) {
    return 'Medium';
  }
  return 'Low';
}

/** Builds the next sequential incident id (INC-<year><5-digit seq>). */
async function nextIncidentId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INC-${year}`;
  const last = await IncidentReport.findOne({
    incidentId: { $regex: `^${prefix}\\d{5}$` },
  })
    .sort({ incidentId: -1 })
    .select('incidentId')
    .lean();
  const seq = last ? parseInt(last.incidentId.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

/**
 * Incident Reports — Create
 * Use-case: create an incident report. Residents report their own incidents;
 * staff/admin may create for any resident.
 * POST /incident-reports (authenticated)
 */
export async function createIncidentReport(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  const body = parseBody(event) as CreateIncidentBody;

  const { incidentCategory, descriptionText, locationDetails } = body;

  // The report owner is derived from the caller for self-service creates — a
  // resident's (or official's, acting through the resident portal) JWT `sub` is
  // their own Resident `_id`, so the client never needs to send a `residentId`.
  // Admins filing on a resident's behalf must still supply an explicit
  // `residentId`.
  const effectiveResidentId =
    body.residentId || (auth.role === 'admin' ? undefined : auth.userId);

  if (!effectiveResidentId || !incidentCategory || !descriptionText || !locationDetails) {
    return badRequest(
      'residentId, incidentCategory, descriptionText, and locationDetails are required.'
    );
  }

  // Defense-in-depth: residents can only file reports for themselves.
  assertOwnResidentRef(auth, effectiveResidentId);

  // `Duplicate` needs the original report it repeats, which is only known when
  // an admin performs a status transition — never at creation time.
  if (body.incidentStatus === 'Duplicate') {
    throw badRequestError(
      'Duplicate status must be set by updating the report with the original incident.'
    );
  }

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

  const incidentId = await nextIncidentId();
  // Residents (and officials acting through the resident portal) always open a
  // report as Pending; only an admin filing on someone's behalf may set it.
  const incidentStatus =
    auth.role === 'admin' ? body.incidentStatus || 'Pending' : 'Pending';
  const changedBy = await actorIdentity(auth);
  const reportedAt = new Date();
  const report = await IncidentReport.create({
    incidentId,
    residentId: resident._id,
    incidentCategory,
    descriptionText,
    locationDetails,
    // System-driven triage: priority is computed by rules, not chosen by a human.
    triagePriority: computeTriagePriority(incidentCategory, descriptionText),
    evidenceMediaUrls: body.evidenceMediaUrls || [],
    incidentStatus,
    // History starts at filing so residents always see an origin step.
    timeline: [
      {
        step: incidentStatus,
        date: reportedAt,
        status: 'completed',
        changedBy: changedBy ?? undefined,
      },
    ],
    reportedAt,
  });

  // Notify all active admins of the new incident over the real-time channel.
  const name = await residentFullName(String(resident._id));
  await notifyAllActiveAdmins({
    category: 'incidentAlert',
    titleText: 'New Incident Report',
    messageBody: `${name} created an incident report: ${incidentCategory}: ${descriptionText}`,
    referenceUrlId: incidentId,
  });

  return created(report.toObject(), 'Incident report created.');
}

export const handler = withErrorHandling(createIncidentReport);