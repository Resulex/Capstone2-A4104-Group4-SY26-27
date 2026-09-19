import type { APIGatewayProxyEvent } from 'aws-lambda';
import mongoose from 'mongoose';
import { forbiddenError, unauthorizedError, notFoundError } from './errors';
import { Admin, Resident } from '../models';
import { connectToDatabase } from '../config/db';
import { residentFullName } from './notifications';

/**
 * RBAC authorization helpers.
 *
 * The auth-jwt authorizer authenticates a request and injects:
 *   event.requestContext.authorizer = { userId, role }
 * where `role` is the User.role claim ('resident' | 'official' | 'admin').
 *
 * These helpers enforce authorization inside handlers:
 * - Role guards throw a 403 AppError when the caller's role is insufficient.
 * - Ownership guards scope residents to their own data.
 *
 * For role === 'admin', we additionally load the matching Admin document so
 * the finer-grained `assignedRole` ('Admin' | 'Moderator' | 'Content Admin')
 * can be enforced for admin-management operations.
 */

export type AppRole = 'resident' | 'official' | 'admin';
export type AdminAssignedRole = 'SUPER_ADMIN' | 'OPERATIONS_CLERK' | 'INFO_OFFICER';

/**
 * Admin roles that may see the shared chat queue — the backend mirror of the
 * frontend's `canAccessAdminRoute(role, '/admin/chat-sessions')` matrix.
 *
 * Chat notifications and the "awaiting reply" push are addressed to these roles
 * ONLY: an INFO_OFFICER cannot open `/admin/chat-sessions`, so a chat alert for
 * them was an unactionable bell entry. Keep this in step with `lib/rbac.ts`.
 */
export const CHAT_STAFF_ROLES: AdminAssignedRole[] = [
  'SUPER_ADMIN',
  'OPERATIONS_CLERK',
];

export interface AuthContext {
  userId: string;
  role: AppRole;
  /** Present when role === 'admin' and an Admin document matches the user. */
  admin?: {
    adminId: string;
    assignedRole: AdminAssignedRole;
    accountStatus: string;
  } | null;
}

/** Reads the authenticated caller identity from the authorizer context. */
export function getAuthContext(event: APIGatewayProxyEvent): AuthContext {
  const authorizer = event.requestContext.authorizer as
    | { userId?: string; role?: string; principalId?: string }
    | undefined;

  const userId = authorizer?.userId ?? authorizer?.principalId;
  const role = (authorizer?.role as AppRole) || undefined;

  if (!userId) {
    throw unauthorizedError('Authentication required.');
  }
  if (!role) {
    throw unauthorizedError('Missing role claim on token.');
  }

  return { userId, role };
}

/** Loads the Admin document for an admin caller (for assignedRole checks). */
export async function loadAdminContext(
  auth: AuthContext
): Promise<NonNullable<AuthContext['admin']>> {
  if (auth.role !== 'admin') {
    throw forbiddenError('This operation requires an administrator.');
  }
  // Ensure the connection exists BEFORE the first query below — handlers call
  // resolveAuthContext() before their own connectToDatabase(), so on a cold
  // start this query would otherwise buffer and time out.
  await connectToDatabase();
  const admin = await Admin.findOne({ adminId: auth.userId })
    .orFail()
    .catch(() => null);
  if (!admin) {
    // Fall back to matching by _id if adminId is not the JWT sub.
    const byId = mongoose.isValidObjectId(auth.userId)
      ? await Admin.findById(auth.userId)
      : null;
    if (!byId) {
      throw forbiddenError('No administrator record found for this account.');
    }
    return {
      adminId: byId.adminId,
      assignedRole: byId.assignedRole,
      accountStatus: byId.accountStatus,
    };
  }
  return {
    adminId: admin.adminId,
    assignedRole: admin.assignedRole,
    accountStatus: admin.accountStatus,
  };
}

/** Resolves admin context on an AuthContext (mutates + returns it). */
export async function withAdminContext(auth: AuthContext): Promise<AuthContext> {
  if (auth.role === 'admin') {
    auth.admin = await loadAdminContext(auth);
  }
  return auth;
}

/**
 * Builds a full AuthContext, loading the Admin record when the caller is an
 * admin. Use this at the top of admin-facing handlers.
 */
export async function resolveAuthContext(
  event: APIGatewayProxyEvent
): Promise<AuthContext> {
  const auth = getAuthContext(event);
  return withAdminContext(auth);
}

/** Identifies the human behind a status change, for the history/audit trail. */
export interface ChangeActor {
  userId: string;
  fullName: string;
}

/**
 * Resolves the display identity of the caller making a status change. Admins
 * resolve against the Admin collection, officials are Resident-backed, and
 * residents (who may not change statuses) resolve to null. The returned name is
 * denormalized onto the history entry so it survives later profile renames.
 */
export async function actorIdentity(
  auth: AuthContext
): Promise<ChangeActor | null> {
  if (auth.role === 'admin') {
    await connectToDatabase();
    const admin = await Admin.findOne({ adminId: auth.userId })
      .orFail()
      .catch(() => null);
    const resolved =
      admin ??
      (mongoose.isValidObjectId(auth.userId)
        ? await Admin.findById(auth.userId)
        : null);
    if (!resolved) return null;
    return {
      userId: String(resolved._id),
      fullName:
        [resolved.firstName, resolved.middleName, resolved.lastName]
          .filter(Boolean)
          .join(' ') || resolved.userName,
    };
  }

  if (auth.role === 'official') {
    // Officials operate through the resident portal, so their token `sub` is a
    // Resident `_id` and their display name comes from the same lookup.
    return { userId: auth.userId, fullName: await residentFullName(auth.userId) };
  }

  return null;
}

/**
 * Display name for a STORED `senderId` (not a live caller).
 *
 * `Message.senderId` deliberately carries no `ref`: it is an Admin `_id` for an
 * admin and a Resident `_id` for an official, so both collections are tried — the
 * same resolution `actorIdentity()` applies to a caller. Returns null when
 * neither matches (a re-provisioned account), which callers must treat as "name
 * unknown" rather than falling back to a placeholder person.
 *
 * Read-only, unlike `actorIdentity`, so it is safe to use when re-deriving
 * denormalized names that a later delete invalidated.
 */
export async function senderDisplayName(
  senderId: unknown
): Promise<string | null> {
  if (!senderId) return null;
  await connectToDatabase();
  const id = String(senderId);

  const joinName = (person: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    suffix?: string | null;
  }): string | null =>
    [person.firstName, person.middleName, person.lastName, person.suffix]
      .filter(Boolean)
      .join(' ') || null;

  if (mongoose.isValidObjectId(id)) {
    const admin = await Admin.findById(id)
      .select('firstName middleName lastName userName')
      .lean();
    if (admin) return joinName(admin) ?? admin.userName ?? null;

    const resident = await Resident.findById(id)
      .select('firstName middleName lastName suffix')
      .lean();
    if (resident) return joinName(resident);
  }

  // Fall back to the human id, so a notification-style reference still resolves.
  const byCustomId = await Resident.findOne({ residentId: id })
    .select('firstName middleName lastName suffix')
    .lean();
  return byCustomId ? joinName(byCustomId) : null;
}

// ---------------------------------------------------------------------------
// Role guards
// ---------------------------------------------------------------------------

/** Throws 403 unless the caller has the `admin` role. */
export function requireAdmin(auth: AuthContext): void {
  if (auth.role !== 'admin') {
    throw forbiddenError('Requires the admin role.');
  }
}

/** Throws 403 unless the caller is staff (official) or an admin. */
export function requireStaffOrAdmin(auth: AuthContext): void {
  if (auth.role !== 'official' && auth.role !== 'admin') {
    throw forbiddenError('Requires staff or admin clearance.');
  }
}

/**
 * Throws 403 unless the admin caller holds one of the given assigned roles
 * (e.g. only 'Admin' may delete administrators / change roles).
 */
export function requireAssignedRole(
  auth: AuthContext,
  allowed: AdminAssignedRole[]
): void {
  requireAdmin(auth);
  if (!auth.admin || !allowed.includes(auth.admin.assignedRole)) {
    throw forbiddenError('This operation requires a higher admin role.');
  }
}

/**
 * Throws 403 unless the caller is an admin with the SUPER_ADMIN role.
 * Super admins own user/role management.
 */
export function requireSuperAdmin(auth: AuthContext): void {
  requireAssignedRole(auth, ['SUPER_ADMIN']);
}

// ---------------------------------------------------------------------------
// Ownership guards (data isolation)
// ---------------------------------------------------------------------------

/**
 * Returns the resident ObjectId whose data the caller is allowed to manage.
 * - admin: unrestricted (returns null meaning "no scope").
 * - official: scoped to their barangay (handled by the caller via barangayId).
 * - resident: must match the caller's own resident id.
 *
 * A resident is identified by `_id` (equal to the JWT `sub` for both Google-SSO
 * and self-registered residents); the custom `residentId` field may be unset, so
 * we accept a match against either.
 */
export function assertResidentOwnership(
  auth: AuthContext,
  resident: { _id?: unknown; residentId?: unknown }
): void {
  if (auth.role === 'admin') return;
  if (auth.role === 'official') return; // barangay scope enforced by caller
  // resident: only their own record
  const ownerId = String(resident._id ?? resident.residentId ?? '');
  if (auth.userId !== ownerId) {
    throw forbiddenError('You can only access your own records.');
  }
}

/**
 * Guards a resident-owned document (e.g. DocumentRequest, IncidentReport)
 * by comparing the record's residentId against the caller's own residentId.
 */
export function assertOwnResidentRecord(
  auth: AuthContext,
  recordResidentId: mongoose.Types.ObjectId | string | null | undefined
): void {
  if (auth.role === 'admin') return;
  if (auth.role === 'official') return; // barangay scope enforced by caller
  if (!recordResidentId || auth.userId !== String(recordResidentId)) {
    throw forbiddenError('You can only access your own records.');
  }
}

/**
 * Validates that a supplied residentId in a create/update payload belongs to
 * the caller (resident) — residents can only create/own their own records.
 */
export function assertOwnResidentRef(
  auth: AuthContext,
  payloadResidentId?: mongoose.Types.ObjectId | string | null
): void {
  if (auth.role === 'admin') return;
  if (auth.role === 'official') return;
  if (!payloadResidentId || auth.userId !== String(payloadResidentId)) {
    throw forbiddenError('You can only create records for yourself.');
  }
}

/**
 * Whether the caller may read a chat session's messages.
 *
 * Live chat is a SHARED staff queue, not a private responder-to-resident
 * thread: `chat-sessions/list` returns every session to every admin,
 * `messages/create` lets any admin reply, and the session endpoints scope
 * residents only (via `assertOwnResidentRecord`). The message READ gate has to
 * agree with that, otherwise an admin who is not the session's `adminId` sees
 * an empty thread for records that plainly exist.
 *
 * Returns a boolean rather than throwing so each caller keeps its own error
 * contract (`messages/list` answers 400, `messages/get` answers 404).
 */
export function canReadSessionMessages(
  auth: AuthContext,
  session: { residentId?: unknown }
): boolean {
  if (auth.role === 'admin' || auth.role === 'official') return true;
  return auth.userId === String(session.residentId);
}

// ---------------------------------------------------------------------------
// Helpers for list filtering / lookups
// ---------------------------------------------------------------------------

/** Builds a "scope" filter for resident-owned collections. */
export function residentScopeFilter(
  auth: AuthContext
): Record<string, unknown> {
  if (auth.role === 'admin' || auth.role === 'official') return {};
  if (mongoose.isValidObjectId(auth.userId)) {
    return { residentId: new mongoose.Types.ObjectId(auth.userId) };
  }
  // The resident's `residentId` (string) is used as their _id elsewhere; here
  // we fall back to matching the residentId string field.
  return { residentId: auth.userId };
}

/** Builds a scope filter for Notification.recipientId. */
export function notificationScopeFilter(
  auth: AuthContext
): Record<string, unknown> {
  if (auth.role === 'admin') return {};
  if (mongoose.isValidObjectId(auth.userId)) {
    return { recipientId: new mongoose.Types.ObjectId(auth.userId) };
  }
  return { recipientId: auth.userId };
}

/** Converts a path/query string id to an ObjectId, throwing 404 on invalid. */
export function toObjectId(id: string, label = 'record'): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) {
    throw notFoundError(`${label} not found.`);
  }
  return new mongoose.Types.ObjectId(id);
}

/** Guards that a found document's owner matches the caller for resident data. */
export function ensureResidentRecordAccess(
  auth: AuthContext,
  doc: { residentId?: mongoose.Types.ObjectId | string } | null,
  label = 'record'
): void {
  if (!doc) throw notFoundError(`${label} not found.`);
  assertOwnResidentRecord(auth, doc.residentId);
}

