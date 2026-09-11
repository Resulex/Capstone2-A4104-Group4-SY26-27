"use client";

import { createTheme, Theme, ThemeOptions } from "@mui/material/styles";

/**
 * Typographic scaling options exposed by the accessibility theme context.
 *
 * - `"xs"`      → −25% base size (12px) for compact/dense reading.
 * - `"small"`   → −12.5% base size (14px).
 * - `"default"` → standard Material Design body size (1rem / 16px).
 * - `"large"`   → +25% base size for low-vision / readability support.
 * - `"xl"`      → +50% base size (extra-large).
 * - `"xxl"`     → +100% base size (extra-extra-large).
 */
export type FontScale = "xs" | "small" | "default" | "large" | "xl" | "xxl";

export const FONT_SCALE_OPTIONS: FontScale[] = [
  "xs",
  "small",
  "default",
  "large",
  "xl",
  "xxl",
];

/** Maps each font-scale option to a multiplier applied to the root font size. */
const FONT_SCALE_MULTIPLIERS: Record<FontScale, number> = {
  xs: 0.75,     // 12px
  small: 0.875, // 14px
  default: 1,   // 16px
  large: 1.25,  // 20px
  xl: 1.5,      // 24px
  xxl: 2,       // 32px
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
 * App-shell surface tints — a light primary wash for the headers and an even
 * lighter, near-neutral wash for the sidebars. Both keep the shell text well
 * above the WCAG AA 4.5:1 contrast ratio.
 */
const SHELL_HEADER = "#E8F1FA";
const SHELL_SIDEBAR = "#F4F8FC";

/**
 * Primary shell text colors — a darker shade of each surface's own hue rather
 * than neutral black, so the text sits tonally with its background.
 */
const SHELL_HEADER_TEXT = "#083C6B"; // deep civic blue (families with #E8F1FA)
const SHELL_SIDEBAR_TEXT = "#1B2733"; // dark slate (families with #F4F8FC)

/**
 * Resolves the app-shell surface colors for the current accessibility mode.
 *
 * High-contrast mode falls back to plain white so the high-contrast palette
 * (yellow accent / black text) stays the dominant, maximum-legibility
 * treatment instead of competing with a decorative tint.
 */
export function getShellColors(highContrast: boolean): {
  header: string;
  sidebar: string;
  headerText: string;
  sidebarText: string;
} {
  return highContrast
    ? {
        header: "#FFFFFF",
        sidebar: "#FFFFFF",
        headerText: "#000000",
        sidebarText: "#000000",
      }
    : {
        header: SHELL_HEADER,
        sidebar: SHELL_SIDEBAR,
        headerText: SHELL_HEADER_TEXT,
        sidebarText: SHELL_SIDEBAR_TEXT,
      };
}

/**
 * Auth-card surface — the same light primary wash as the shell headers,
 * reused for the resident/admin sign-in cards so the auth screens read as part
 * of the civic-blue family rather than plain white.
 *
 * Text contrast on `#E8F1FA` is unaffected: body text `#1B2733` and secondary
 * `#475569` both stay well above the WCAG AA 4.5:1 ratio (see the shell-color
 * contrast table in the repo notes).
 */
const AUTH_CARD_SURFACE = SHELL_HEADER;

/**
 * Resolves the sign-in card background for the current accessibility mode.
 * High-contrast mode falls back to plain white so the high-contrast palette
 * stays the dominant, maximum-legibility treatment.
 */
export function getAuthCardSurface(highContrast: boolean): string {
  return highContrast ? "#FFFFFF" : AUTH_CARD_SURFACE;
}

/**
 * Telemetry-card surface — a soft top-down wash that starts at the shell
 * header tint and fades to white, so the dashboard metric cards read as part
 * of the same civic-blue family as the app bar and sidebar.
 *
 * High-contrast mode resolves to flat white: the header tint is white there
 * too, so the high-contrast palette stays the dominant, maximum-legibility
 * treatment (same rule as `getShellColors` / `getAuthCardSurface`).
 */
export function getTelemetryCardGradient(highContrast: boolean): string {
  return `linear-gradient(180deg, ${
    getShellColors(highContrast).header
  } 0%, #FFFFFF 100%)`;
}

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
      fontFamily: `var(--font-inter, "Inter"), Inter, Helvetica, Arial, sans-serif`,
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
            // MUI's htmlFontSize only affects its internal px→rem math; the
            // <html> element must actually receive this size so `rem`-based
            // text scales correctly (larger = bigger, not inverted).
            fontSize: `${16 * multiplier}px`,
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
