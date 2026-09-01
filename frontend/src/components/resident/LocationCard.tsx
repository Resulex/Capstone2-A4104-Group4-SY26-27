"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PhoneIcon from "@mui/icons-material/Phone";
import MapIcon from "@mui/icons-material/Map";

interface LocationCardProps {
  /** Barangay hall / area address. */
  address: string;
  /** Optional contact phone displayed under the address. */
  phone?: string;
  /** Optional external maps URL for the "Get Directions" action. */
  mapsUrl?: string;
}

/**
 * Reusable location card: a decorative map placeholder with a location pin,
 * the address, an optional phone line, and a "Get Directions" action. Used on
 * the dashboard (and future pages) to show the barangay's location.
 */
export function LocationCard({ address, phone, mapsUrl }: LocationCardProps) {
  return (
    <Box>
      {/* Decorative map placeholder (no map library dependency). */}
      <Box
        role="img"
        aria-label={`Map location for ${address}`}
        sx={{
          position: "relative",
          width: "100%",
          height: { xs: 180, sm: 220 },
          borderRadius: 2,
          overflow: "hidden",
          background: (theme) =>
            `linear-gradient(120deg, ${theme.palette.primary.light}33 0%, ${theme.palette.secondary.light}22 60%, #ffffff 100%)`,
          border: 1,
          borderColor: "divider",
        }}
      >
        {/* Subtle road-grid decoration. */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0.5,
            backgroundImage:
              "linear-gradient(#ffffff66 1px, transparent 1px), linear-gradient(90deg, #ffffff66 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Location pin. */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <LocationOnIcon
            sx={{
              fontSize: 44,
              color: "error.main",
              filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.3))",
            }}
          />
          <Box
            sx={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "8px solid",
              borderTopColor: "error.main",
            }}
          />
        </Box>
        <Box
          sx={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            bgcolor: "background.paper",
            borderRadius: 2,
            px: 1,
            py: 0.5,
            boxShadow: 1,
          }}
        >
          <MapIcon sx={{ fontSize: 16, color: "primary.main" }} />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Barangay
          </Typography>
        </Box>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            <LocationOnIcon sx={{ fontSize: 20, color: "text.secondary", mt: 0.25 }} />
            <Typography variant="body2" color="text.secondary">
              {address}
            </Typography>
          </Box>
          {phone && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75 }}>
              <PhoneIcon sx={{ fontSize: 20, color: "text.secondary" }} />
              <Typography variant="body2" color="text.secondary">
                {phone}
              </Typography>
            </Box>
          )}
        </Box>
        {mapsUrl && (
          <Button
            component="a"
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<MapIcon />}
            sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
          >
            Get Directions
          </Button>
        )}
      </Stack>
    </Box>
  );
}
