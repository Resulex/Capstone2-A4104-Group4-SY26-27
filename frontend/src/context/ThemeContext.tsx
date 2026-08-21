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

const FONT_SCALE_ORDER: FontScale[] = ["default", "large", "xl"];

export function AccessibilityThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [fontScale, setFontScaleState] = useState<FontScale>("default");
  const [highContrast, setHighContrast] = useState(false);

  const setFontScale = useCallback((scale: FontScale) => {
    setFontScaleState(scale);
  }, []);

  const cycleFontScale = useCallback(() => {
    setFontScaleState((current) => {
      const index = FONT_SCALE_ORDER.indexOf(current);
      const next = (index + 1) % FONT_SCALE_ORDER.length;
      return FONT_SCALE_ORDER[next];
    });
  }, []);

  const toggleHighContrast = useCallback(() => {
    setHighContrast((current) => !current);
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
