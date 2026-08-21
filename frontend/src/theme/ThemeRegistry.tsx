"use client";

import { ReactNode } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useAccessibilityTheme } from "@/context/ThemeContext";
import { getTheme } from "@/theme/theme";

/**
 * Client-side theme registry that wires the MUI App Router SSR cache
 * (`AppRouterCacheProvider`) together with the accessibility-driven theme.
 *
 * `AppRouterCacheProvider` prevents CSS-in-JS hydration mismatches and the
 * flash of unstyled content (FOUC) by caching emotion styles on the server
 * and reusing them on the client.
 */
export default function ThemeRegistry({ children }: { children: ReactNode }) {
  const { fontScale, highContrast } = useAccessibilityTheme();
  const theme = getTheme(fontScale, highContrast);

  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}