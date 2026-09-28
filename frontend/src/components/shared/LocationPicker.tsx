"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  BARANGAY_AREA,
  LOCATION_PICKER_FOCUS_ZOOM,
  LOCATION_PICKER_MAX_ZOOM,
  LOCATION_PICKER_MIN_ZOOM,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  formatCoordinates,
  osmLink,
  type BarangayArea,
  type Coordinates,
} from "@/lib/geo";

export interface LocationPickerProps {
  /** Current pin, or `null` when the resident has not placed one yet. */
  value: Coordinates | null;
  /**
   * Called when the pin is placed or dragged. The picker is controlled: it does
   * not move the marker itself, it reports the new point and waits for `value`
   * to come back down.
   */
  onChange?: (coordinates: Coordinates) => void;
  /** Extent the map is clamped to. Defaults to the barangay fallback area. */
  area?: BarangayArea;
  /** Render as a viewer: no click-to-place, no dragging, no geolocation button. */
  readOnly?: boolean;
  /** Map height in pixels. */
  height?: number;
  /** Hint shown beneath the map while no pin has been placed. */
  helperText?: string;
}

/**
 * Map pin picker for incident locations.
 *
 * Renders OpenStreetMap raster tiles with Leaflet (free, no API key or account)
 * and clamps the view to the barangay so a resident cannot pin somewhere the
 * barangay cannot respond to. The same component serves the read-only view on
 * the incident detail page via `readOnly`.
 *
 * MUST be loaded through `next/dynamic` with `ssr: false`: Leaflet reads
 * `window` while its module is evaluated, which fails during the App Router's
 * server render. Its callers are client components, so that wrapper is allowed.
 *
 * Attribution is required by OpenStreetMap's tile usage policy and is rendered
 * by Leaflet's built-in attribution control — do not disable it.
 */
export default function LocationPicker({
  value,
  onChange,
  area = BARANGAY_AREA,
  readOnly = false,
  height = 300,
  helperText,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Read by the mount effect only, so the map is never torn down and rebuilt
  // just because a prop identity changed. Later changes are applied in place.
  const initialRef = useRef({ area, readOnly });

  // Kept in a ref so the Leaflet listeners registered once at mount always call
  // the latest callback instead of the one captured on the first render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [status, setStatus] = useState<{
    severity: "warning" | "info";
    message: string;
  } | null>(null);

  const pinColor = useTheme().palette.error.main;

  // A DOM marker rather than Leaflet's default image marker: the bundled
  // default icon resolves its PNG URLs relative to the stylesheet, which breaks
  // under a bundler, and an inline pin also lets the theme colour apply.
  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html:
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="38" height="38" ` +
          `style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">` +
          `<path fill="${pinColor}" fill-rule="evenodd" stroke="#ffffff" stroke-width="1" ` +
          `d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>` +
          `</svg>`,
        iconSize: [38, 38],
        // Tip of the teardrop, so the pin points at the coordinate itself.
        iconAnchor: [19, 37],
      }),
    [pinColor],
  );

  // Create the map once. Everything that can change is applied by later effects.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const { area: initialArea, readOnly: initialReadOnly } = initialRef.current;
    const bounds = L.latLngBounds(
      [initialArea.bounds.south, initialArea.bounds.west],
      [initialArea.bounds.north, initialArea.bounds.east],
    );

    const map = L.map(container, {
      minZoom: LOCATION_PICKER_MIN_ZOOM,
      maxZoom: LOCATION_PICKER_MAX_ZOOM,
      maxBounds: bounds,
      maxBoundsViscosity: 1,
      // Free panning is confined to the barangay; `fitBounds` below then frames
      // the whole of it, so a resident always starts inside the area.
      attributionControl: true,
      // Wheel zoom would otherwise hijack the page scroll while the resident is
      // filling in the form above and below it. Buttons and pinch still zoom.
      scrollWheelZoom: false,
    });

    L.tileLayer(OSM_TILE_URL, {
      maxZoom: LOCATION_PICKER_MAX_ZOOM,
      attribution: OSM_ATTRIBUTION,
    }).addTo(map);

    map.fitBounds(bounds, { padding: [16, 16] });

    if (!initialReadOnly) {
      map.on("click", (event: L.LeafletMouseEvent) => {
        onChangeRef.current?.({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        });
      });
    }

    // `navigator.geolocation` through Leaflet. The result is clamped to the
    // barangay: "use my location" while standing outside it would otherwise
    // drop a pin the barangay cannot act on.
    map.on("locationfound", (event: L.LocationEvent) => {
      if (!bounds.contains(event.latlng)) {
        setStatus({
          severity: "warning",
          message:
            "Your current position is outside the barangay. Drag the pin to the incident location instead.",
        });
        return;
      }
      setStatus(null);
      onChangeRef.current?.({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
      map.setView(event.latlng, Math.max(map.getZoom(), LOCATION_PICKER_FOCUS_ZOOM));
    });

    map.on("locationerror", () => {
      setStatus({
        severity: "warning",
        message:
          "We could not read your location. Allow location access, or drag the pin to the spot.",
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Keep the pin in step with `value`.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const latlng = L.latLng(value.latitude, value.longitude);

    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
      return;
    }

    const marker = L.marker(latlng, {
      icon: pinIcon,
      draggable: !initialRef.current.readOnly,
      alt: "Incident location",
    }).addTo(map);

    marker.on("dragend", () => {
      const moved = marker.getLatLng();
      onChangeRef.current?.({ latitude: moved.lat, longitude: moved.lng });
    });

    markerRef.current = marker;
  }, [value, pinIcon]);

  // `readOnly` is fixed per usage, but keeping drag state in step costs little
  // and avoids a stale marker if a caller ever toggles it.
  useEffect(() => {
    const dragging = markerRef.current?.dragging;
    if (!dragging) return;
    if (readOnly) dragging.disable();
    else dragging.enable();
  }, [readOnly, value]);

  // Relocate the viewport if the caller resolves the barangay area after the
  // first render (e.g. once `GET /barangays/{id}` returns).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMaxBounds(
      L.latLngBounds(
        [area.bounds.south, area.bounds.west],
        [area.bounds.north, area.bounds.east],
      ),
    );
  }, [area]);

  const handleLocate = () => {
    setStatus(null);
    mapRef.current?.locate({ enableHighAccuracy: true, timeout: 10000 });
  };

  return (
    <Box>
      {status && (
        <Alert severity={status.severity} sx={{ mb: 1.5 }}>
          {status.message}
        </Alert>
      )}

      {/*
        `isolation: isolate` traps Leaflet's internal z-indexes (panes reach
        ~700, controls 1000) inside this box, so the map cannot paint over the
        MUI `Select` menu elsewhere on the form.
      */}
      <Box
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
          isolation: "isolate",
        }}
      >
        <Box
          ref={containerRef}
          aria-label={
            readOnly
              ? value
                ? `Incident location map, pinned at ${formatCoordinates(value)}`
                : "Incident location map"
              : "Map for pinning the incident location"
          }
          sx={{
            width: "100%",
            height,
            bgcolor: "action.hover",
            // Leaflet needs to measure the container; it must not collapse.
            minHeight: height,
          }}
        />
      </Box>

      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 1, flexWrap: "wrap", alignItems: "center" }}
      >
        {!readOnly && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<MyLocationIcon />}
            onClick={handleLocate}
          >
            Use my current location
          </Button>
        )}
        {value && (
          <Button
            size="small"
            href={osmLink(value)}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<OpenInNewIcon />}
          >
            Open in OpenStreetMap
          </Button>
        )}
      </Stack>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 0.5 }}
      >
        {value
          ? `Pinned at ${formatCoordinates(value)}`
          : (helperText ??
            (readOnly
              ? "No pinned location for this report."
              : "Tap the map to drop a pin, then drag it to the exact spot."))}
      </Typography>
    </Box>
  );
}
