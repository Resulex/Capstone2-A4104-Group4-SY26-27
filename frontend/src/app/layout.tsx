import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { AccessibilityThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import ThemeRegistry from "@/theme/ThemeRegistry";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
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
    <html lang="en" className={roboto.variable}>
      <body>
        <AccessibilityThemeProvider>
          <AuthProvider>
            <ThemeRegistry>{children}</ThemeRegistry>
          </AuthProvider>
        </AccessibilityThemeProvider>
      </body>
    </html>
  );
}
