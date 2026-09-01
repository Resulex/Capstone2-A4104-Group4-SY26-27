"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Image from "next/image";
import Link from "next/link";
import CampaignIcon from "@mui/icons-material/Campaign";
import { AnnouncementRecord } from "@/lib/admin";
import { formatDisplayDate } from "@/lib/resident";

interface AnnouncementCardProps {
  /** The announcement to display. */
  announcement: AnnouncementRecord;
  /** Detail route, e.g. `/announcements/{id}`. */
  href: string;
}

/**
 * Reusable announcement card: an image (or branded placeholder), the title,
 * the publication date, and a clamped description. Used on the dashboard and
 * the full announcements list. Falls back to the branded placeholder if the
 * remote image fails to load (e.g. a stale S3 URL).
 */
export function AnnouncementCard({ announcement, href }: AnnouncementCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(announcement.imageUrl) && !imgFailed;
  const date = formatDisplayDate(announcement.createdAt ?? announcement.eventDate);

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
      <CardActionArea
        component={Link}
        href={href}
        aria-label={announcement.titleText}
        sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "stretch" }}
      >
        {showImage ? (
          <Box
            sx={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              bgcolor: "action.hover",
            }}
          >
            <Image
              src={announcement.imageUrl as string}
              alt=""
              fill
              sizes="(max-width: 600px) 100vw, 50vw"
              style={{ objectFit: "cover" }}
              onError={() => setImgFailed(true)}
            />
          </Box>
        ) : (
          <Box
            aria-hidden
            sx={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: (theme) =>
                `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              color: "common.white",
            }}
          >
            <CampaignIcon sx={{ fontSize: 44, opacity: 0.85 }} />
          </Box>
        )}
        <CardContent sx={{ p: 2.5, flexGrow: 1 }}>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.5 }}
          >
            {announcement.titleText}
          </Typography>
          {date && (
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {date}
            </Typography>
          )}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 1,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {announcement.descriptionContent}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
