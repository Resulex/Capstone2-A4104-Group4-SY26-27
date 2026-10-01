import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Resident, User } from '../../../models';
import { resolveAuthContext, requireStaffOrAdmin } from '../../../shared/authorization';
import { archiveScopeFilter } from '../../../shared/archive';

/**
 * Residents — List
 * Use-case: list residents. Admins see all; officials see their barangay's
 * residents. Residents are not allowed to list residents. Archived records are
 * excluded unless a SUPER_ADMIN asks for `?scope=archived`.
 * GET /residents?scope=active|archived (staff or admin)
 */
export async function listResidents(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  // `resolveAuthContext` (not `getAuthContext`): the archived scope needs the
  // admin's `assignedRole`, which only the loaded Admin document carries.
  const auth = await resolveAuthContext(event);
  requireStaffOrAdmin(auth);

  await connectToDatabase();

  // Archived residents are hidden from the list; only a SUPER_ADMIN can ask for
  // them back. The helper matches `isDeleted` as "not equal to true", which
  // keeps records that predate the field visible without a backfill migration.
  const query: Record<string, unknown> = archiveScopeFilter(event, auth, 'isDeleted');
  if (auth.role === 'official') {
    // Scope to the official's own barangay via their User record.
    const user = await User.findById(auth.userId);
    if (!user) {
      throw new Error('Staff account not found.');
    }
    query.barangay = user.barangay;
  }

  const residents = await Resident.find(query).lean();
  const publicList = residents.map((r) => {
    // Destructured purely to omit the hash; the binding is intentionally unused.
    const { passwordHash: _passwordHash, ...rest } = r as unknown as Record<string, unknown>;
    return rest;
  });

  return ok(publicList, 'Residents fetched.');
}

export const handler = withErrorHandling(listResidents);