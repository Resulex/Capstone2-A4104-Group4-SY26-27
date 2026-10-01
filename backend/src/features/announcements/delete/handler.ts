import { archiveHandler } from '../archive/handler';

/**
 * Announcements — Delete (compatibility alias)
 *
 * This route used to call `deleteOne()`, which destroyed the announcement
 * outright. That made announcements the single record type the system could not
 * retrieve, contradicting the retention requirement — and it was the only hard
 * delete left in the service.
 *
 * Rather than remove the route (a caller would simply 404 with no explanation),
 * it now delegates to the archive handler. A client written against the old
 * contract keeps working and can no longer lose data. Prefer
 * `POST /announcements/{id}/archive`; this alias exists only for older clients.
 *
 * `archiveHandler` is already `withErrorHandling`-wrapped, so re-exporting it
 * directly is correct — wrapping it a second time would be redundant.
 *
 * SUPER_ADMIN only, inherited from the archive handler.
 * DELETE /announcements/{id} (super admin)
 */
export const handler = archiveHandler;