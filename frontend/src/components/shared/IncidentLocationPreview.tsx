"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { IncidentRecord } from "@/lib/admin";
import {
  BARANGAY_AREA,
  LOCATION_PICKER_FOCUS_ZOOM,
  LOCATION_PICKER_MAX_ZOOM,
  LOCATION_PICKER_MIN_ZOOM,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  coordinatesFrom,
  formatCoordinates,
} from "@/lib/geo";
import {
  PIN_ICON_ANCHOR,
  PIN_ICON_SIZE,
  pinSvg,
  priorityColorKey,
} from "@/lib/incident-pins";

export interface IncidentLocationPreviewProps {
  /** Report whose pin is shown. */
  incident: IncidentRecord;
  /** Map width in pixels. */
  width?: number;
  /** Map height in pixels. */
  height?: number;
}

/**
 * Mini read-only map for one incident's pin, shown in the Location-cell hover
 * popup.
 *
 * Same keyless OpenStreetMap base as `IncidentMap` and the resident
 * `LocationPicker`, but deliberately INERT: no pan, zoom, drag or marker
 * interaction, because it is opened by hover and must never fight the pointer
 * still resting on the table cell behind it. That is also why the caller gives
 * the popup `pointerEvents: "none"`.
 *
 * MUST be loaded through `next/dynamic` with `ssr: false` (Leaflet reads
 * `window` while its module is evaluated), and the caller keys it by
 * `incidentId` so hovering another row mounts a fresh instance rather than
 * leaving a stale pin behind.
 */
export default function IncidentLocationPreview({
  incident,
  width = 320,
  height = 200,
}: IncidentLocationPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pin = coordinatesFrom(incident);
  const latitude = pin?.latitude;
  const longitude = pin?.longitude;
  const color = useTheme().palette[priorityColorKey(incident.triagePriority)]
    .main;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || latitude === undefined || longitude === undefined) return;

    const bounds = L.latLngBounds(
      [BARANGAY_AREA.bounds.south, BARANGAY_AREA.bounds.west],
      [BARANGAY_AREA.bounds.north, BARANGAY_AREA.bounds.east],
    );

    const map = L.map(container, {
      minZoom: LOCATION_PICKER_MIN_ZOOM,
      maxZoom: LOCATION_PICKER_MAX_ZOOM,
      maxBounds: bounds,
      maxBoundsViscosity: 1,
      zoomControl: false,
      // Attribution is required by OpenStreetMap's tile usage policy, so it stays
      // on even in a 320px preview.
      attributionControl: true,
      // Inert on purpose — see the component docblock. Every interaction handler
      // is switched off rather than relying on Leaflet's `interactive` option,
      // which is a per-handler concept and is not part of the typed MapOptions.
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      scrollWheelZoom: false,
    });

    L.tileLayer(OSM_TILE_URL, {
      maxZoom: LOCATION_PICKER_MAX_ZOOM,
      attribution: OSM_ATTRIBUTION,
    }).addTo(map);

    L.marker([latitude, longitude], {
      icon: L.divIcon({
        className: "",
        html: pinSvg(color),
        iconSize: PIN_ICON_SIZE,
        iconAnchor: PIN_ICON_ANCHOR,
      }),
      interactive: false,
      alt: `Pinned location for ${incident.incidentId}`,
    }).addTo(map);

    map.setView([latitude, longitude], LOCATION_PICKER_FOCUS_ZOOM);

    // The popup is portalled and positioned by Popper, so Leaflet's first
    // measurement can land before the paper has its final size — without this
    // the tiles render into a grey box.
    const frame = requestAnimationFrame(() => map.invalidateSize());

    return () => {
      cancelAnimationFrame(frame);
      map.remove();
    };
  }, [latitude, longitude, color, incident.incidentId]);

  if (!pin) return null;

  return (
    <Box>
      <Box
        ref={containerRef}
        role="img"
        aria-label={`Map preview of ${incident.incidentId} at ${formatCoordinates(pin)}`}
        sx={{
          width,
          height,
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: "action.hover",
          // Leaflet's panes reach z-index ~700; keep them inside this box.
          isolation: "isolate",
        }}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 0.5, maxWidth: width }}
      >
        {incident.incidentId} · {formatCoordinates(pin)}
      </Typography>
    </Box>
  );
}
