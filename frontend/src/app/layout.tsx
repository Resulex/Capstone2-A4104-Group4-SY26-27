import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AccessibilityThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { ResidentProvider } from "@/context/ResidentContext";
import ThemeRegistry from "@/theme/ThemeRegistry";
import "./globals.css";

// Inter is loaded as a variable font (no explicit `weight`), so every weight
// used in the app — including the 800s in the resident incident views —
// renders as a real Inter weight instead of a synthesized one.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KaBarangayConnect",
    template: "%s | KaBarangayConnect",
  },
  description:
    "KaBarangayConnect — digital services and civic engagement platform for your barangay.",
  applicationName: "KaBarangayConnect",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AccessibilityThemeProvider>
          <AuthProvider>
            <ResidentProvider>
              <ThemeRegistry>{children}</ThemeRegistry>
            </ResidentProvider>
          </AuthProvider>
        </AccessibilityThemeProvider>
      </body>
    </html>
  );
}
