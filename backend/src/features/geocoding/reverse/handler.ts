import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { withErrorHandling } from '../../../shared/handler';
import { ok, badRequest } from '../../../shared/responses';
import { parseCoordinates } from '../../../shared/coordinates';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Reverse geocode — turn a map pin into a human-readable address.
 *
 * Nominatim's usage policy requires an identifying `User-Agent` (which a browser
 * cannot set) and roughly one request per second, so this proxy owns both: it
 * sets the header server-side and spaces out calls per warm Lambda instance.
 *
 * The base URL and User-Agent are configurable so production can point at a
 * self-hosted instance without a code change.
 *
 * This is a best-effort convenience for the incident form, so an upstream
 * failure returns a `null` display name rather than a 5xx — a panicking
 * resident must never be blocked on a geocoder.
 */

const NOMINATIM_URL =
  process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org';

const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  'KaBarangayConnect/1.0 (Barangay Labuin, Pila, Laguna; contact: kbc@example.com)';

/** Nominatim allows ~1 req/s; keep at least this much space between calls. */
const NOMINATIM_MIN_INTERVAL_MS = 1100;

let lastCallAt = 0;

/**
 * Geocoding — Reverse
 * Use-case: derive the human-readable address for an incident map pin so the
 * resident form can auto-fill a Location field without the resident typing it.
 * GET /geocoding/reverse?latitude=…&longitude=… (authenticated)
 */
async function reverseGeocode(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  getAuthContext(event);

  const query = event.queryStringParameters || {};
  const coordinates = parseCoordinates(query.latitude, query.longitude);
  if (!coordinates) {
    return badRequest('latitude and longitude query parameters are required.');
  }

  // Space out upstream calls: a burst of pin drags must not exceed the rate
  // Nominatim expects from a single client.
  const elapsed = Date.now() - lastCallAt;
  if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS - elapsed)
    );
  }
  lastCallAt = Date.now();

  const url =
    `${NOMINATIM_URL}/reverse?format=jsonv2` +
    `&lat=${coordinates.latitude}&lon=${coordinates.longitude}` +
    `&zoom=18&addressdetails=1&accept-language=en`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
    });
    if (!response.ok) {
      console.error('[Geocoding.Reverse] Nominatim error', response.status);
      return ok({ displayName: null });
    }
    const data = (await response.json()) as { display_name?: string };
    return ok({ displayName: data.display_name ?? null });
  } catch (error) {
    console.error('[Geocoding.Reverse] Nominatim unreachable', error);
    return ok({ displayName: null });
  }
}

export const handler = withErrorHandling(reverseGeocode);
