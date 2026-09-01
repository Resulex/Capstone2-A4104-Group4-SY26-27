"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Image from "next/image";
import Link from "next/link";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { BARANGAY_CONTACT } from "@/lib/resident";

const QUICK_LINKS = [
  { label: "Announcements", href: "/announcements" },
  { label: "Document Requests", href: "/documents" },
  { label: "Incident Reports", href: "/incidents" },
  { label: "Barangay Officials", href: "/officials" },
];

const LEGAL_LINKS = [
  { label: "Data Privacy Policy", href: "/legal" },
  { label: "Terms of Service", href: "/legal" },
];

/**
 * Reusable footer for the resident section: brand + tagline, quick links,
 * legal links, and contact details. Rendered by the resident shell below the
 * page content.
 */
export function ResidentFooter() {
  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 3, md: 2 }}
          justifyContent="space-between"
        >
          {/* Brand. */}
          <Box sx={{ maxWidth: 320 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
              <Box sx={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
                <Image
                  src="/images/KaBarangay-logo.png"
                  alt="KaBarangayConnect logo"
                  fill
                  style={{ objectFit: "contain" }}
                  sizes="40px"
                />
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                KaBarangayConnect
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Connecting communities through smarter barangay management,
              streamlined services, and real-time incident reporting.
            </Typography>
          </Box>

          {/* Quick links. */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Quick Links
            </Typography>
            <Stack spacing={0.75}>
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  style={{ textDecoration: "none" }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      "&:hover": { color: "primary.main" },
                      transition: "color 0.15s ease",
                    }}
                  >
                    {link.label}
                  </Typography>
                </Link>
              ))}
            </Stack>
          </Box>

          {/* Legal. */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Policies
            </Typography>
            <Stack spacing={0.75}>
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  style={{ textDecoration: "none" }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      "&:hover": { color: "primary.main" },
                      transition: "color 0.15s ease",
                    }}
                  >
                    {link.label}
                  </Typography>
                </Link>
              ))}
            </Stack>
          </Box>

          {/* Contact. */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Barangay Hall
            </Typography>
            <Stack spacing={0.75}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <PhoneIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                <Typography variant="body2" color="text.secondary">
                  {BARANGAY_CONTACT.hotline}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <LocationOnIcon sx={{ fontSize: 18, color: "text.secondary", mt: 0.25 }} />
                <Typography variant="body2" color="text.secondary">
                  {BARANGAY_CONTACT.address}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          component="p"
        >
          © {new Date().getFullYear()} Barangay {BARANGAY_CONTACT.address.split(",")[0].replace("Purok 2 ", "")} ·
          KaBarangayConnect. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
}
