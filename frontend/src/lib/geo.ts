/**
 * Geographic constants and helpers for the barangay incident map.
 *
 * KaBarangayConnect serves a single barangay, so the picker is clamped to that
 * barangay's extent rather than the open world. That has two benefits: a
 * resident cannot pin (or pan to) somewhere the barangay cannot respond to, and
 * it puts a hard ceiling on how many OpenStreetMap tiles one session can ever
 * request, which keeps the app comfortably inside OSM's tile usage policy.
 */

/** A point on the map, in WGS84 decimal degrees. */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Axis-aligned box enclosing the barangay. */
export interface AreaBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** The mapped extent: where the map opens, and how far it may be panned. */
export interface BarangayArea {
  center: Coordinates;
  bounds: AreaBounds;
}

/**
 * Fallback extent of Barangay Labuin, Pila, Laguna, taken from OpenStreetMap
 * (relation 17242188): roughly 1.44 km x 1.53 km, about 2.2 km2.
 *
 * Used when the barangay record carries no `center`/`bounds` — dev rows seeded
 * before the map picker existed, or a backend response missing the field. A
 * partial record (a center with no bounds) also falls back here, because a
 * center without bounds would leave the map pannable anywhere.
 */
export const BARANGAY_AREA: BarangayArea = {
  center: { latitude: 14.24459, longitude: 121.3694078 },
  bounds: {
    north: 14.2522804,
    south: 14.2393353,
    east: 121.3750758,
    west: 121.3608884,
  },
};

/**
 * Zoom limits for the picker. The whole barangay fits at roughly z16, and z19 is
 * the deepest detail `tile.openstreetmap.org` serves, so there is nothing to be
 * gained by allowing a wider range.
 */
export const LOCATION_PICKER_MIN_ZOOM = 15;
export const LOCATION_PICKER_MAX_ZOOM = 19;

/** Zoom used when recentring on a resident's own position. */
export const LOCATION_PICKER_FOCUS_ZOOM = 18;

/**
 * Read a `{ latitude, longitude }` pair off a record, or `null` when it is
 * incomplete or out of range.
 *
 * Both halves are validated as a pair rather than each number on its own: a
 * record can only carry one without the other if it was written outside the API
 * (the handlers reject half a pin), and a lone latitude would place a marker
 * somewhere meaningless.
 */
export function coordinatesFrom(
  record?:
    | { latitude?: number | null; longitude?: number | null }
    | null,
): Coordinates | null {
  const latitude = record?.latitude;
  const longitude = record?.longitude;

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

/** Build a `BarangayArea` from a record that may or may not carry one. */
export function resolveBarangayArea(
  record?: {
    center?: { latitude?: number; longitude?: number } | null;
    bounds?: {
      north?: number;
      south?: number;
      east?: number;
      west?: number;
    } | null;
  } | null,
): BarangayArea {
  const center = coordinatesFrom(record?.center);
  const bounds = record?.bounds;

  if (!center) return BARANGAY_AREA;
  if (
    typeof bounds?.north !== "number" ||
    typeof bounds.south !== "number" ||
    typeof bounds.east !== "number" ||
    typeof bounds.west !== "number"
  ) {
    return BARANGAY_AREA;
  }

  return {
    center,
    bounds: {
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
    },
  };
}

/** Human-readable pin, e.g. `14.24459° N, 121.36941° E` (about 1 m precision). */
export function formatCoordinates({ latitude, longitude }: Coordinates): string {
  const lat = `${Math.abs(latitude).toFixed(5)}° ${latitude < 0 ? "S" : "N"}`;
  const lng = `${Math.abs(longitude).toFixed(5)}° ${longitude < 0 ? "W" : "E"}`;
  return `${lat}, ${lng}`;
}

/** Link to the same point on the OpenStreetMap website (a manual cross-check). */
export function osmLink({ latitude, longitude }: Coordinates): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${LOCATION_PICKER_MAX_ZOOM}/${latitude}/${longitude}`;
}

/** Tile layer + attribution for OpenStreetMap's standard raster tiles. */
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
