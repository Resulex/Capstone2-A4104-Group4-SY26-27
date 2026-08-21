import type { APIGatewayProxyEvent } from 'aws-lambda';
import mongoose from 'mongoose';
import { forbiddenError, unauthorizedError, notFoundError } from './errors';
import { Admin } from '../models';

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
export type AdminAssignedRole = 'Admin' | 'Moderator' | 'Content Admin';

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

// ---------------------------------------------------------------------------
// Ownership guards (data isolation)
// ---------------------------------------------------------------------------

/**
 * Returns the resident ObjectId whose data the caller is allowed to manage.
 * - admin: unrestricted (returns null meaning "no scope").
 * - official: scoped to their barangay (handled by the caller via barangayId).
 * - resident: must match the caller's own residentId.
 */
export function assertResidentOwnership(
  auth: AuthContext,
  residentId: mongoose.Types.ObjectId | string
): void {
  if (auth.role === 'admin') return;
  if (auth.role === 'official') return; // barangay scope enforced by caller
  // resident: only their own record
  if (auth.userId !== String(residentId)) {
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
