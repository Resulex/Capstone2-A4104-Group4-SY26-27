/**
 * Pin rendering shared by the incident map and the per-row hover preview.
 *
 * Deliberately Leaflet-free: the preview is loaded in its own `ssr: false`
 * chunk, and keeping these helpers out of `IncidentMap` is what stops a static
 * import from dragging Leaflet into a module that has to stay server-render
 * safe.
 */

/** Theme palette colour backing each triage priority (mirrors the priority Chip). */
export type PriorityColorKey = "error" | "warning" | "info" | "success";

const PRIORITY_COLOR_KEY: Record<string, PriorityColorKey> = {
  Critical: "error",
  High: "warning",
  Medium: "info",
  Low: "success",
};

/** Palette key for a triage priority, defaulting the way the priority Chip does. */
export function priorityColorKey(priority: string): PriorityColorKey {
  return PRIORITY_COLOR_KEY[priority] ?? "success";
}

/** Marker geometry, shared so the banner map and the preview pins match. */
export const PIN_ICON_SIZE: [number, number] = [38, 38];
/** Tip of the teardrop, so the pin points at the coordinate itself. */
export const PIN_ICON_ANCHOR: [number, number] = [19, 37];

/**
 * Inline-SVG teardrop, rather than Leaflet's bundled default icon: that one
 * resolves its PNGs relative to the stylesheet and breaks under a bundler, and
 * an inline pin can carry the priority colour. `color` comes from the theme
 * palette, never from user input.
 */
export function pinSvg(color: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="38" height="38" ` +
    `style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">` +
    `<path fill="${color}" fill-rule="evenodd" stroke="#ffffff" stroke-width="1" ` +
    `d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>` +
    `</svg>`
  );
}
