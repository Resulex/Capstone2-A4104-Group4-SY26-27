"use client";

import { useEffect, useMemo, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { IncidentRecord } from "@/lib/admin";
import {
  BARANGAY_AREA,
  LOCATION_PICKER_MAX_ZOOM,
  LOCATION_PICKER_MIN_ZOOM,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  coordinatesFrom,
  type BarangayArea,
} from "@/lib/geo";
import {
  PIN_ICON_ANCHOR,
  PIN_ICON_SIZE,
  pinSvg,
  priorityColorKey,
} from "@/lib/incident-pins";

export interface IncidentMapProps {
  /**
   * Incidents to pin. Already filtered by the caller, so the map and whatever
   * list feeds it can never disagree about which reports are in scope.
   */
  incidents: IncidentRecord[];
  /**
   * Report to single out (the row the admin is hovering). Its pin is drawn even
   * when `incidents` does not contain it — a hover is an explicit request to see
   * one record, so a status filter hiding it should not make the hover a no-op.
   */
  focusIncident?: IncidentRecord | null;
  /** Extent the map is clamped to. Defaults to the barangay fallback area. */
  area?: BarangayArea;
  /** Map height in pixels. */
  height?: number;
}

/** Pin hover text: `[INC-00007] - Flood (Sep 28, 2026, 3:45 PM)`. */
function pinLabel(incident: IncidentRecord): string {
  return `[${incident.incidentId}] - ${incident.incidentCategory} (${formatPinDateTime(incident.reportedAt)})`;
}

/**
 * Timestamp for the pin hover, e.g. `Sep 28, 2026, 3:45 PM`.
 *
 * Deliberately NOT the shared `formatDateTime()` from `lib/resident.ts`: that
 * one omits the year for the resident chat/history views, and a command-center
 * map can hold reports from more than one year.
 */
function formatPinDateTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Leaflet renders tooltip content as HTML, so the label is escaped rather than
 * injected raw. Values are backend-generated, but escaping here means a hostile
 * value can never become markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Read-only incident map: one pin per report, coloured by triage priority, with
 * the report's identity on hover.
 *
 * Renders OpenStreetMap raster tiles with Leaflet — the exact base the resident
 * app's `LocationPicker` uses, so both sides of the app show the same map, with
 * no API key or account. The view is clamped to the barangay for the same reason
 * there: it frames the area the barangay actually responds to, and caps how many
 * tiles a session can request.
 *
 * MUST be loaded through `next/dynamic` with `ssr: false`: Leaflet reads
 * `window` while its module is evaluated, which fails during the App Router's
 * server render. Its callers are client components, so that wrapper is allowed.
 *
 * Attribution is required by OpenStreetMap's tile usage policy and is rendered
 * by Leaflet's built-in attribution control — do not disable it.
 */
export default function IncidentMap({
  incidents,
  focusIncident = null,
  area = BARANGAY_AREA,
  height = 400,
}: IncidentMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  /** Live markers by incident id, so the focus effect can open their tooltips. */
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Read by the mount effect only, so the map is never torn down and rebuilt
  // just because a prop identity changed.
  const initialAreaRef = useRef(area);

  const palette = useTheme().palette;

  /** Reports that actually have a pin; coordinate-less records cannot be drawn. */
  const drawable = useMemo(
    () => incidents.filter((incident) => coordinatesFrom(incident) !== null),
    [incidents],
  );

  /**
   * The pins to draw: the caller's filtered list, narrowed to a single report
   * while the admin hovers its row. Filtering rather than merely recentring is
   * what the hover is for — one record placed on the map — and it also keeps
   * the other pins from sitting under the open tooltip.
   */
  const pinnedIncidents = useMemo(() => {
    if (focusIncident && coordinatesFrom(focusIncident) !== null) {
      return [focusIncident];
    }
    return drawable;
  }, [drawable, focusIncident]);

  /**
   * Stable identity for the marker set. The marker effect keys off this string
   * rather than the array, because the array is rebuilt on every render —
   * including every Location-cell hover. Keying off the array would tear down
   * and re-add every pin each time, closing the tooltip under the cursor.
   */
  const pinSignature = pinnedIncidents
    .map(
      (i) =>
        `${i.incidentId}:${i.triagePriority}:${i.latitude},${i.longitude}`,
    )
    .join("|");

  // Latest values for the effects below, synced in effects declared BEFORE them
  // so they are up to date by the time those effects run.
  const pinnedIncidentsRef = useRef(pinnedIncidents);
  useEffect(() => {
    pinnedIncidentsRef.current = pinnedIncidents;
  });

  const focusIncidentRef = useRef(focusIncident);
  useEffect(() => {
    focusIncidentRef.current = focusIncident;
  });

  // Create the map once. Everything that can change is applied by later effects.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    // Captured for the cleanup: a ref read inside a cleanup may point somewhere
    // else by then (and the linter is right to flag it).
    const markers = markersRef.current;

    const initialBounds = L.latLngBounds(
      [initialAreaRef.current.bounds.south, initialAreaRef.current.bounds.west],
      [initialAreaRef.current.bounds.north, initialAreaRef.current.bounds.east],
    );

    const map = L.map(container, {
      minZoom: LOCATION_PICKER_MIN_ZOOM,
      maxZoom: LOCATION_PICKER_MAX_ZOOM,
      maxBounds: initialBounds,
      maxBoundsViscosity: 1,
      attributionControl: true,
      // Wheel zoom would hijack the page scroll while the admin scrolls the
      // queue below it. Buttons and pinch still zoom.
      scrollWheelZoom: false,
    });

    L.tileLayer(OSM_TILE_URL, {
      maxZoom: LOCATION_PICKER_MAX_ZOOM,
      attribution: OSM_ATTRIBUTION,
    }).addTo(map);

    map.fitBounds(initialBounds, { padding: [16, 16] });

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markers.clear();
    };
  }, []);

  // Draw (or redraw) the pins whenever the marker set changes.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    layer.clearLayers();
    markersRef.current.clear();

    for (const incident of pinnedIncidentsRef.current) {
      const pin = coordinatesFrom(incident);
      if (!pin) continue;

      const color = palette[priorityColorKey(incident.triagePriority)].main;
      const label = pinLabel(incident);

      const marker = L.marker([pin.latitude, pin.longitude], {
        icon: L.divIcon({
          className: "",
          html: pinSvg(color),
          iconSize: PIN_ICON_SIZE,
          iconAnchor: PIN_ICON_ANCHOR,
        }),
        // Screen-reader/keyboard label; the tooltip is the visible affordance.
        alt: label,
        title: label,
      });

      marker.bindTooltip(escapeHtml(label), {
        direction: "top",
        offset: [0, -36],
      });

      marker.addTo(layer);
      markersRef.current.set(incident.incidentId, marker);
    }
  }, [pinSignature, palette]);

  // Frame the viewport. The map is moved ONLY for a focused pin that is outside
  // the current view: an empty-looking map whose tooltip is anchored off-screen
  // would be worse than a small pan. It deliberately never refits on a filter
  // change, so nothing here overwrites the admin's own pan and zoom — the whole
  // barangay already fits the default view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const focus = focusIncidentRef.current;
    const pin = coordinatesFrom(focus);

    for (const [id, marker] of markersRef.current) {
      if (!focus || !pin || id !== focus.incidentId) marker.closeTooltip();
    }

    if (!focus || !pin) return;

    map.panInside(L.latLng(pin.latitude, pin.longitude), {
      padding: [48, 48],
    });
    markersRef.current.get(focus.incidentId)?.openTooltip();
  }, [focusIncident, pinSignature]);

  // Relocate the viewport if the caller resolves the barangay area after the
  // first render (e.g. once the barangay record returns).
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

  const count = pinnedIncidents.length;
  const focused = focusIncident && coordinatesFrom(focusIncident) ? focusIncident : null;

  return (
    <Box>
      {/*
        `isolation: isolate` traps Leaflet's internal z-indexes (panes reach
        ~700, controls 1000) inside this box, so the map cannot paint over the
        MUI `Select` menus and dialogs elsewhere on the page.
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
          role="img"
          aria-label={
            focused
              ? `Incident map showing ${focused.incidentId} only`
              : count > 0
                ? `Incident map showing ${count} pinned report${count === 1 ? "" : "s"}`
                : "Incident map with no pinned reports"
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

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 0.5 }}
      >
        {focused
          ? `Showing ${focused.incidentId} only — move the pointer off the row to see every pin`
          : count > 0
            ? `${count} pinned report${count === 1 ? "" : "s"} — hover a pin for details`
            : "No pinned reports match the current filters."}
      </Typography>
    </Box>
  );
}
