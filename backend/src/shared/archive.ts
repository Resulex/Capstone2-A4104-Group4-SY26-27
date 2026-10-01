import type { APIGatewayProxyEvent } from 'aws-lambda';
import { badRequestError } from './errors';
import { requireSuperAdmin, type AuthContext } from './authorization';

/**
 * Soft-archive scope helpers.
 *
 * Archiving is a SUPER_ADMIN-only governance action: an archived record leaves
 * every normal queue — including the owning resident's own list — and is
 * retrievable only through the admin Archived view. These helpers are the one
 * place that decides what the `?scope=` query parameter may mean, so the six
 * list handlers cannot drift apart or forget the permission check.
 *
 * Deliberately NOT a `shared/handler.ts` concern: that module is about parsing
 * the request (body, path params), whereas this one makes an authorization
 * decision on top of the query string.
 */

/** Which slice of a collection a list request is asking for. */
export type ArchiveScope = 'active' | 'archived';

const ARCHIVE_SCOPES = ['active', 'archived'] as const;

/**
 * Reads `?scope=` from the request. Absent means `active`, which is what every
 * existing caller already expects — so adding this parameter changed no
 * behaviour for requests that do not send it.
 *
 * An unrecognised value is a 400 rather than a silent fallback to `active`: a
 * typo'd scope that quietly returned the wrong slice would look like a data bug.
 */
export function parseArchiveScope(event: APIGatewayProxyEvent): ArchiveScope {
  const raw = event.queryStringParameters?.scope;
  if (raw === undefined || raw === null || raw === '') return 'active';
  if (!(ARCHIVE_SCOPES as readonly string[]).includes(raw)) {
    throw badRequestError(
      'Invalid "scope" query parameter. Use "active" or "archived".'
    );
  }
  return raw as ArchiveScope;
}

/**
 * Builds the archive clause for a list query.
 *
 * - `active`   → "not archived", matched as `ne: true` rather than `false` so
 *   records that predate the field stay visible even on a database where the
 *   `-archive-flags` migration has not run. Getting this wrong is not a subtle
 *   bug: the strict form would blank out an entire admin queue.
 * - `archived` → `true`, and gated behind `requireSuperAdmin`. A non-super
 *   caller asking for the archived slice gets a 403 instead of a quietly empty
 *   list, so the refusal is visible rather than looking like "no results".
 *
 * @param flagField the soft-delete column for this collection. Residents and
 *   officials predate the archive flag and use `isDeleted`.
 */
export function archiveScopeFilter(
  event: APIGatewayProxyEvent,
  auth: AuthContext,
  flagField = 'isArchived'
): Record<string, unknown> {
  const scope = parseArchiveScope(event);

  if (scope === 'active') {
    return { [flagField]: { $ne: true } };
  }

  requireSuperAdmin(auth);
  return { [flagField]: true };
}
