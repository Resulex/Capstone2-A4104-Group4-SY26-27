"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Image from "next/image";
import Link from "next/link";
import CampaignIcon from "@mui/icons-material/Campaign";
import EventIcon from "@mui/icons-material/Event";
import { PageHeader } from "@/components/resident/PageHeader";
import { StatusChip } from "@/components/resident/StatusChip";
import { EmptyState } from "@/components/resident/EmptyState";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";
import { AnnouncementRecord } from "@/lib/admin";
import { fetchAnnouncement, formatDisplayDate } from "@/lib/resident";

/**
 * Announcement Details (`/announcements/{id}`).
 *
 * Fetches a single announcement (matched by custom `announcementId` or `_id`)
 * and shows the image, title, priority, date and full description.
 */
export default function AnnouncementDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [announcement, setAnnouncement] = useState<AnnouncementRecord | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchAnnouncement(id);
      if (!cancelled) setAnnouncement(data);
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const date = announcement
    ? formatDisplayDate(announcement.createdAt ?? announcement.eventDate)
    : "";
  const showImage = Boolean(announcement?.imageUrl) && !imgFailed;

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }}>
      <PageHeader
        backHref="/announcements"
        title="Announcement"
        subtitle={announcement?.titleText}
      />

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !announcement ? (
        <EmptyState
          title="Announcement not found"
          description="This announcement may have been removed or is no longer visible."
          action={
            <Button component={Link} href="/announcements" variant="contained">
              Back to Announcements
            </Button>
          }
        />
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
          {showImage ? (
            <Box
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 7",
                bgcolor: "action.hover",
              }}
            >
              <Image
                src={announcement.imageUrl as string}
                alt={announcement.titleText}
                fill
                sizes="(max-width: 760px) 100vw, 760px"
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
                aspectRatio: "16 / 7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                color: "common.white",
              }}
            >
              <CampaignIcon sx={{ fontSize: 64, opacity: 0.85 }} />
            </Box>
          )}

          <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1 }}>
              <StatusChip status={announcement.priorityLevel} />
              {date && (
                <Typography variant="body2" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <EventIcon sx={{ fontSize: 16 }} />
                  {date}
                </Typography>
              )}
            </Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
              {announcement.titleText}
            </Typography>
            {announcement.eventDate && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Event date: {formatDisplayDate(announcement.eventDate)}
              </Typography>
            )}
            <Typography variant="body1" color="text.primary" sx={{ lineHeight: 1.7 }}>
              {announcement.descriptionContent}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
