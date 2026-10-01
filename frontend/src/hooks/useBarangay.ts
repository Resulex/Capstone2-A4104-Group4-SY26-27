"use client";

import { useEffect, useState } from "react";
import {
  BARANGAY_AREA,
  resolveBarangayArea,
  type BarangayArea,
} from "@/lib/geo";
import { fetchBarangay, loadResidentProfile } from "@/lib/resident";

/**
 * The resident's own barangay: the map extent plus the purok vocabulary.
 *
 * Resolved from the resident's barangay record so both the bounds and the purok
 * list stay data-driven rather than baked into the pages. Returns the fallbacks
 * (`BARANGAY_AREA`, no puroks) until the lookup settles, and keeps returning them
 * permanently when the profile or the barangay record is unavailable — so the
 * map is always usable and never waits on the network to render.
 */
export interface BarangayContext {
  /** Extent the incident map is framed to and clamped by. */
  area: BarangayArea;
  /**
   * The puroks an incident report's location may name, or an empty list while
   * the lookup is in flight and when it fails.
   *
   * Empty is "unavailable", never "no puroks are valid": the backend rejects a
   * purok it cannot check, so a form must refuse to submit rather than send one.
   */
  puroks: string[];
  /**
   * True until the barangay lookup settles. Lets a caller tell "still loading"
   * from "the vocabulary is genuinely unavailable" — an empty `puroks` alone
   * cannot distinguish the two, and the difference decides whether a form shows
   * a placeholder or refuses to submit.
   */
  loading: boolean;
}

export function useBarangay(): BarangayContext {
  const [context, setContext] = useState<BarangayContext>({
    area: BARANGAY_AREA,
    puroks: [],
    loading: true,
  });

  useEffect(() => {
    const barangayId = loadResidentProfile()?.barangay;
    if (!barangayId) {
      // Nothing to fetch: settle immediately so a caller never waits forever.
      setContext((prev) => ({ ...prev, loading: false }));
      return;
    }

    let cancelled = false;
    void (async () => {
      // Never throws: resolves to null on any failure.
      const barangay = await fetchBarangay(barangayId);
      if (cancelled) return;

      setContext({
        area: barangay ? resolveBarangayArea(barangay) : BARANGAY_AREA,
        // A half-filled document must not widen the vocabulary, so drop blanks.
        puroks: (barangay?.puroks ?? []).filter(
          (purok): purok is string => typeof purok === "string" && !!purok.trim(),
        ),
        loading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return context;
}
