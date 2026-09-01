"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { OfficialRecord } from "@/lib/admin";

/** Derive initials from a full name, e.g. "Juan Dela Cruz" → "JD". */
export function initialsFromName(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface OfficialCardProps {
  /** The official to display. */
  official: OfficialRecord;
}

/**
 * Reusable barangay official card: avatar, name + position, contact details,
 * and key responsibilities. Used on the Officials directory page.
 */
export function OfficialCard({ official }: OfficialCardProps) {
  const responsibilities = official.coreResponsibilities ?? [];

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Avatar
            src={official.profileImageUrl}
            sx={{ width: 52, height: 52, bgcolor: "primary.main", fontSize: 18 }}
          >
            {initialsFromName(official.fullName)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {official.fullName}
            </Typography>
            <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
              {official.designatedPosition}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PhoneIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="body2" color="text.secondary">
              {official.contactNumber}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <EmailIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
              {official.emailAddress}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            <LocationOnIcon sx={{ fontSize: 18, color: "text.secondary", mt: 0.25 }} />
            <Typography variant="body2" color="text.secondary">
              {official.officeLocation}
            </Typography>
          </Box>
        </Box>

        {responsibilities.length > 0 && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Key Responsibilities
            </Typography>
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2 }}>
              {responsibilities.map((item, index) => (
                <Typography
                  key={`${item}-${index}`}
                  component="li"
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.5 }}
                >
                  {item}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
