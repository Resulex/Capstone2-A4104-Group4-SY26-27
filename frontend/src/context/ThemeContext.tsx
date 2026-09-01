"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { FontScale } from "@/theme/theme";

export interface AccessibilityThemeContextValue {
  /** Current typographic scaling level. */
  fontScale: FontScale;
  /** Whether high-contrast mode is enabled. */
  highContrast: boolean;
  /** Sets the typographic scaling level directly. */
  setFontScale: (scale: FontScale) => void;
  /** Cycles to the next typographic scaling level. */
  cycleFontScale: () => void;
  /** Toggles high-contrast mode. */
  toggleHighContrast: () => void;
}

const AccessibilityThemeContext =
  createContext<AccessibilityThemeContextValue | null>(null);

const FONT_SCALE_ORDER: FontScale[] = ["small", "default", "large", "xl", "xxl"];

const FONT_SCALE_STORAGE_KEY = "kbc_font_scale";
const HIGH_CONTRAST_STORAGE_KEY = "kbc_high_contrast";

/** Read the persisted typographic scale, falling back to the default. */
function readStoredFontScale(): FontScale {
  try {
    if (typeof window === "undefined") return "default";
    const stored = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    return (FONT_SCALE_ORDER as string[]).includes(stored as string)
      ? (stored as FontScale)
      : "default";
  } catch {
    return "default";
  }
}

/** Read the persisted high-contrast flag, defaulting to off. */
function readStoredHighContrast(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function AccessibilityThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [fontScale, setFontScaleState] = useState<FontScale>(readStoredFontScale);
  const [highContrast, setHighContrast] = useState(readStoredHighContrast);

  const setFontScale = useCallback((scale: FontScale) => {
    setFontScaleState(scale);
    try {
      window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, scale);
    } catch {
      // Storage unavailable; the setting just won't persist.
    }
  }, []);

  const cycleFontScale = useCallback(() => {
    setFontScaleState((current) => {
      const index = FONT_SCALE_ORDER.indexOf(current);
      const next = (index + 1) % FONT_SCALE_ORDER.length;
      const scale = FONT_SCALE_ORDER[next];
      try {
        window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, scale);
      } catch {
        // ignore
      }
      return scale;
    });
  }, []);

  const toggleHighContrast = useCallback(() => {
    setHighContrast((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = useMemo<AccessibilityThemeContextValue>(
    () => ({
      fontScale,
      highContrast,
      setFontScale,
      cycleFontScale,
      toggleHighContrast,
    }),
    [fontScale, highContrast, setFontScale, cycleFontScale, toggleHighContrast],
  );

  return (
    <AccessibilityThemeContext.Provider value={value}>
      {children}
    </AccessibilityThemeContext.Provider>
  );
}

/**
 * Consume the accessibility theme context. Throws if used outside of the
 * `AccessibilityThemeProvider`.
 */
export function useAccessibilityTheme(): AccessibilityThemeContextValue {
  const context = useContext(AccessibilityThemeContext);
  if (!context) {
    throw new Error(
      "useAccessibilityTheme must be used within an AccessibilityThemeProvider",
    );
  }
  return context;
}
