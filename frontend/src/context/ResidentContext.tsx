"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  ResidentProfile,
  loadResidentProfile,
  saveResidentProfile,
} from "@/lib/resident";

interface ResidentContextValue {
  /** The signed-in resident's public profile (null until known). */
  profile: ResidentProfile | null;
  /** Store the resident profile (from the SSO callback payload). */
  setProfile: (profile: ResidentProfile | null) => void;
  /** Persist a partial profile update locally. */
  updateProfile: (patch: Partial<ResidentProfile>) => void;
  /** Clear the stored profile (on logout). */
  clearProfile: () => void;
}

const ResidentContext = createContext<ResidentContextValue | null>(null);

/**
 * Holds the signed-in resident's public profile.
 *
 * The resident profile arrives in the Google-SSO callback payload (`data.user`),
 * because the backend's `GET /users/me` 404s for residents and `GET /residents/{id}`
 * is not reliably self-accessible. It is persisted to localStorage so the shell
 * (sidebar avatar, header) and the settings page can restore it across reloads.
 */
export function ResidentProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<ResidentProfile | null>(() =>
    loadResidentProfile(),
  );

  const setProfile = useCallback((next: ResidentProfile | null) => {
    setProfileState(next);
    saveResidentProfile(next);
  }, []);

  const updateProfile = useCallback((patch: Partial<ResidentProfile>) => {
    setProfileState((prev) => {
      const next = { ...(prev ?? {}), ...patch };
      saveResidentProfile(next);
      return next;
    });
  }, []);

  const clearProfile = useCallback(() => {
    setProfileState(null);
    saveResidentProfile(null);
  }, []);

  const value = useMemo<ResidentContextValue>(
    () => ({ profile, setProfile, updateProfile, clearProfile }),
    [profile, setProfile, updateProfile, clearProfile],
  );

  return <ResidentContext.Provider value={value}>{children}</ResidentContext.Provider>;
}

/** Consume the resident profile context. Throws if used outside the provider. */
export function useResident(): ResidentContextValue {
  const context = useContext(ResidentContext);
  if (!context) {
    throw new Error("useResident must be used within a ResidentProvider");
  }
  return context;
}
