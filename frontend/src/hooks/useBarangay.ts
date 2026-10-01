"use client";

import { useEffect, useState } from "react";
import {
  BARANGAY_AREA,
  resolveBarangayArea,
  type BarangayArea,
} from "@/lib/geo";
import {
  fetchBarangay,
  fetchBarangays,
  loadResidentProfile,
  type BarangayRecord,
} from "@/lib/resident";

/**
 * The resident's own barangay: the map extent plus the purok vocabulary.
 *
 * `puroks` is read from the barangay LIST rather than `GET /barangays/{id}`.
 * Two reasons:
 *
 *  - The list handler reads raw documents on the backend, so `puroks` comes back
 *    even when the server's compiled schema predates the field, whereas the
 *    single-record route hydrates a document and silently drops it.
 *  - The stored profile is written by the Google-SSO callback, so a resident who
 *    signed up with a password may carry no `barangay` reference at all — that
 *    alone must not leave the vocabulary empty.
 *
 * Returns the fallbacks (`BARANGAY_AREA`, no puroks) until the lookup settles,
 * and keeps returning them when the lookup fails, so the map is always usable
 * and never waits on the network to render.
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

/**
 * Picks the barangay record the map extent and purok list come from.
 *
 * Never throws: resolves to null, and the caller degrades to the fallbacks.
 */
async function resolveBarangay(): Promise<BarangayRecord | null> {
  const profileBarangayId = loadResidentProfile()?.barangay;
  const list = await fetchBarangays();

  const match = profileBarangayId
    ? list.find((barangay) => barangay._id === profileBarangayId)
    : undefined;
  if (match) return match;

  // No match: either the profile carries no usable reference (password sign-ups
  // never receive one) or the list is the only source. Prefer the resident's own
  // record when its id is known, otherwise take the single barangay served here.
  if (profileBarangayId) {
    const own = await fetchBarangay(profileBarangayId);
    if (own) return own;
  }
  return list[0] ?? null;
}

export function useBarangay(): BarangayContext {
  const [context, setContext] = useState<BarangayContext>({
    area: BARANGAY_AREA,
    puroks: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const barangay = await resolveBarangay();
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
