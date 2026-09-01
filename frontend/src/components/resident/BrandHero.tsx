"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Image from "next/image";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";

interface BrandHeroProps {
  /** Optional resident's first name shown in the greeting. */
  residentName?: string;
  /** Barangay hall phone line. */
  phone: string;
  /** Barangay hall address. */
  address: string;
}

/** Barangay hall photo used as the hero backdrop. */
const HERO_IMAGE = "/images/barangay-labuin.png";

/**
 * Dashboard hero: a banner (with the barangay photo backdrop or the brand
 * gradient fallback) featuring the brand badge overlapping its bottom edge,
 * the welcome message, and the barangay contact details. Reusable so other
 * resident landing sections can adopt the same visual rhythm.
 */
export function BrandHero({ residentName, phone, address }: BrandHeroProps) {
  // Fall back to the branded gradient if the photo is missing/unavailable.
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !imgFailed;

  return (
    <Box>
      {/* Banner with overlapping brand badge. */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          minHeight: { xs: 170, sm: 220 },
          borderRadius: { xs: 0, sm: 3 },
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-start",
          px: { xs: 3, sm: 4 },
          pb: { xs: 7, sm: 8 },
        }}
      >
        {showImage ? (
          <>
            <Image
              src={HERO_IMAGE}
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 75vw"
              style={{ objectFit: "cover" }}
              onError={() => setImgFailed(true)}
            />
            {/* Dark overlay keeps the white greeting legible over the photo. */}
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(8,60,107,0.30) 0%, rgba(8,60,107,0.80) 100%)",
              }}
            />
          </>
        ) : (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              background: (theme) =>
                `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.secondary.main} 100%)`,
            }}
          >
            {/* Soft decorative circles. */}
            <Box
              sx={{
                position: "absolute",
                top: -40,
                right: -30,
                width: 180,
                height: 180,
                borderRadius: "50%",
                bgcolor: "rgba(255,255,255,0.08)",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                top: 24,
                left: "55%",
                width: 90,
                height: 90,
                borderRadius: "50%",
                bgcolor: "rgba(255,255,255,0.06)",
              }}
            />
          </Box>
        )}

        <Typography
          variant="h4"
          component="h1"
          sx={{ color: "common.white", fontWeight: 700, position: "relative", textShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
        >
          {residentName ? `Welcome, ${residentName}` : "Welcome"}
        </Typography>
      </Box>

      {/* Brand badge overlapping the banner's bottom edge. */}
      <Box
        sx={{
          display: "flex",
          justifyContent: { xs: "center", sm: "flex-start" },
          px: { xs: 0, sm: 3 },
          mt: -4.5,
          position: "relative",
          zIndex: 2,
        }}
      >
        <Box
          aria-label="KaBarangayConnect logo"
          sx={{
            width: 110,
            height: 110,
            borderRadius: "50%",
            bgcolor: "background.paper",
            border: "5px solid",
            borderColor: "background.paper",
            boxShadow: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Image
            src="/images/KaBarangay-logo.png"
            alt="KaBarangayConnect logo"
            fill
            sizes="120px"
            style={{ objectFit: "contain", padding: -4 }}
          />
        </Box>
      </Box>

      {/* Welcome copy + contact details. */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          mt: 2,
          mb: { xs: 2, sm: 3 },
          textAlign: { xs: "center", sm: "left" },
        }}
      >
        <Typography variant="h5" component="p" sx={{ fontWeight: 700, mb: 0.75 }}>
          Welcome to KaBarangayConnect
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 640, mx: { xs: "auto", sm: 0 }, mb: 2 }}
        >
          Connecting communities through smarter barangay management, streamlined
          services, and real-time incident reporting.
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: { xs: "center", sm: "flex-start" },
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              px: 1.5,
              py: 0.75,
            }}
          >
            <PhoneIcon sx={{ fontSize: 18, color: "primary.main" }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {phone}
            </Typography>
          </Box>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              px: 1.5,
              py: 0.75,
            }}
          >
            <LocationOnIcon sx={{ fontSize: 18, color: "secondary.main" }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {address}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
