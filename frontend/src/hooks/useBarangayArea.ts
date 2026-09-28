"use client";

import { useEffect, useState } from "react";
import {
  BARANGAY_AREA,
  resolveBarangayArea,
  type BarangayArea,
} from "@/lib/geo";
import { fetchBarangay, loadResidentProfile } from "@/lib/resident";

/**
 * The barangay extent the incident map is framed to and clamped by.
 *
 * Resolved from the resident's own barangay record so the bounds stay
 * data-driven rather than baked into the pages. Returns `BARANGAY_AREA` until
 * the lookup settles, and keeps returning it permanently when the profile or the
 * barangay record is unavailable — so the map is always usable and never waits
 * on the network to render.
 */
export function useBarangayArea(): BarangayArea {
  const [area, setArea] = useState<BarangayArea>(BARANGAY_AREA);

  useEffect(() => {
    const barangayId = loadResidentProfile()?.barangay;
    if (!barangayId) return;

    let cancelled = false;
    void (async () => {
      const barangay = await fetchBarangay(barangayId);
      if (!cancelled && barangay) setArea(resolveBarangayArea(barangay));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return area;
}
