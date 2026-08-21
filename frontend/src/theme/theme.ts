"use client";

import { createTheme, Theme, ThemeOptions } from "@mui/material/styles";

/**
 * Typographic scaling options exposed by the accessibility theme context.
 *
 * - `"default"` → standard Material Design body size (1rem / 16px).
 * - `"large"`   → +25% base size for low-vision / readability support.
 * - `"xl"`      → +50% base size (extra-large).
 */
export type FontScale = "default" | "large" | "xl";

export const FONT_SCALE_OPTIONS: FontScale[] = ["default", "large", "xl"];

/** Maps each font-scale option to a multiplier applied to the root font size. */
const FONT_SCALE_MULTIPLIERS: Record<FontScale, number> = {
  default: 1,
  large: 1.25,
  xl: 1.5,
};

/** Civic primary palette for the Barangay platform (blue-leaning civic tone). */
const CIVIC_PRIMARY = {
  main: "#0B5FA5",
  light: "#4A8FC7",
  dark: "#083C6B",
  contrastText: "#FFFFFF",
};

/** Civic secondary palette (teal accent). */
const CIVIC_SECONDARY = {
  main: "#0E7C66",
  light: "#43A68F",
  dark: "#08523F",
  contrastText: "#FFFFFF",
};

/**
 * High-contrast palette (WCAG 2.1 AA/AAA oriented).
 * Uses near-black on yellow / white for maximum contrast and large type pairs.
 */
const HIGH_CONTRAST_PRIMARY = {
  main: "#FFC20E", // high-luminance yellow (AAA on near-black text)
  light: "#FFE08A",
  dark: "#B98A00",
  contrastText: "#000000",
};

const HIGH_CONTRAST_SECONDARY = {
  main: "#000000",
  light: "#1A1A1A",
  dark: "#000000",
  contrastText: "#FFFFFF",
};

/** Builds the core theme with accessibility-driven overrides. */
function buildTheme(fontScale: FontScale, highContrast: boolean): Theme {
  const multiplier = FONT_SCALE_MULTIPLIERS[fontScale];

  const baseOptions: ThemeOptions = {
    palette: {
      mode: "light",
      primary: highContrast ? HIGH_CONTRAST_PRIMARY : CIVIC_PRIMARY,
      secondary: highContrast ? HIGH_CONTRAST_SECONDARY : CIVIC_SECONDARY,
      background: {
        default: highContrast ? "#FFFFFF" : "#F5F7FA",
        paper: "#FFFFFF",
      },
      text: {
        primary: highContrast ? "#000000" : "#1B2733",
        secondary: highContrast ? "#1A1A1A" : "#475569",
      },
      divider: highContrast ? "#000000" : "#D1D9E2",
      error: {
        main: "#D32F2F",
        light: "#EF5350",
        dark: "#9A0007",
        contrastText: "#FFFFFF",
      },
      warning: {
        main: "#ED6C02",
        light: "#FF9800",
        dark: "#E65100",
        contrastText: "#FFFFFF",
      },
      info: {
        main: "#0288D1",
        light: "#03A9F4",
        dark: "#01579B",
        contrastText: "#FFFFFF",
      },
      success: {
        main: "#2E7D32",
        light: "#4CAF50",
        dark: "#1B5E20",
        contrastText: "#FFFFFF",
      },
      action: {
        hover: highContrast ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.06)",
        hoverOpacity: highContrast ? 0.1 : 0.06,
        selected: highContrast ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.08)",
        selectedOpacity: highContrast ? 0.16 : 0.08,
        focus: highContrast ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.12)",
        focusOpacity: highContrast ? 0.16 : 0.12,
        activatedOpacity: highContrast ? 0.16 : 0.12,
        disabled: "rgba(0,0,0,0.38)",
        disabledBackground: "rgba(0,0,0,0.12)",
        disabledOpacity: 0.38,
      },
    },
    typography: {
      fontFamily: `var(--font-roboto), Roboto, Helvetica, Arial, sans-serif`,
      htmlFontSize: 16 * multiplier,
      h1: {
        fontSize: "2.5rem",
        lineHeight: 1.2,
        fontWeight: 700,
      },
      h2: {
        fontSize: "2rem",
        lineHeight: 1.25,
        fontWeight: 700,
      },
      h3: {
        fontSize: "1.5rem",
        lineHeight: 1.3,
        fontWeight: 600,
      },
      h4: {
        fontSize: "1.25rem",
        lineHeight: 1.35,
        fontWeight: 600,
      },
      h5: {
        fontSize: "1.1rem",
        lineHeight: 1.4,
        fontWeight: 600,
      },
      body1: {
        fontSize: "1rem",
        lineHeight: 1.6,
      },
      body2: {
        fontSize: "0.875rem",
        lineHeight: 1.55,
      },
      button: {
        textTransform: "none",
        fontWeight: 600,
        letterSpacing: "0.02em",
      },
    },
    shape: {
      borderRadius: 10,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (themeParam) => ({
          html: {
            WebkitTextSizeAdjust: "100%",
          },
          body: {
            backgroundColor: themeParam.palette.background.default,
            color: themeParam.palette.text.primary,
            transition: "background-color 0.3s ease, color 0.3s ease",
          },
          "*:focus-visible": {
            outline: highContrast ? "3px solid #000000" : "3px solid #0B5FA5",
            outlineOffset: 2,
          },
          "@media (prefers-reduced-motion: reduce)": {
            "*": {
              animationDuration: "0.001ms !important",
              animationIterationCount: "1 !important",
              transitionDuration: "0.001ms !important",
              scrollBehavior: "auto !important",
            },
          },
        }),
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            minHeight: 44, // WCAG 2.5.5 target size
            paddingInline: 20,
            fontWeight: 700,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            minWidth: 44,
            minHeight: 44, // WCAG 2.5.5 touch target
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              minHeight: 44,
            },
          },
        },
      },
      MuiFormControlLabel: {
        styleOverrides: {
          root: {
            alignItems: "flex-start",
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: {
            textUnderlineOffset: 2,
          },
        },
      },
    },
  };

  return createTheme(baseOptions);
}

/**
 * Returns a theme instance derived from the current accessibility settings.
 * Call from within the `AccessibilityThemeProvider` context.
 */
export function getTheme(fontScale: FontScale, highContrast: boolean): Theme {
  return buildTheme(fontScale, highContrast);
}
