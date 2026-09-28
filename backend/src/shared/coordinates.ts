import { badRequestError } from './errors';

/** A pinned location on the map, in WGS84 decimal degrees. */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Validates an optional map-pin location supplied by a client.
 *
 * The two halves are required together: a lone latitude would silently place a
 * marker somewhere meaningless, so a half-filled payload is rejected outright.
 * Each value is range-checked here so bad input fails as a 400 with a readable
 * message instead of surfacing as a Mongoose validation error (a 500).
 *
 * Returns `undefined` when the caller sent neither value, which is the normal
 * case for records that only carry a free-text `locationDetails`.
 */
export function parseCoordinates(
  latitude: unknown,
  longitude: unknown
): Coordinates | undefined {
  const hasLatitude = latitude !== undefined && latitude !== null;
  const hasLongitude = longitude !== undefined && longitude !== null;

  if (!hasLatitude && !hasLongitude) return undefined;
  if (hasLatitude !== hasLongitude) {
    throw badRequestError('latitude and longitude must be provided together.');
  }

  const lat = typeof latitude === 'number' ? latitude : Number(latitude);
  const lng = typeof longitude === 'number' ? longitude : Number(longitude);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw badRequestError('latitude must be a number between -90 and 90.');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw badRequestError('longitude must be a number between -180 and 180.');
  }

  return { latitude: lat, longitude: lng };
}

/** True when a record carries a usable pinned location. */
export function hasCoordinates(
  record: { latitude?: number | null; longitude?: number | null } | null | undefined
): boolean {
  return (
    typeof record?.latitude === 'number' &&
    typeof record?.longitude === 'number' &&
    Number.isFinite(record.latitude) &&
    Number.isFinite(record.longitude)
  );
}
