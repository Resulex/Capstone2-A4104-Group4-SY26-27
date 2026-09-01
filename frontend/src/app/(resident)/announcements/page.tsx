"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { PageHeader } from "@/components/resident/PageHeader";
import { SearchField } from "@/components/resident/SearchField";
import { AnnouncementCard } from "@/components/resident/AnnouncementCard";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";
import { EmptyState } from "@/components/resident/EmptyState";

/**
 * Announcements (`/announcements`).
 *
 * Searchable list of barangay announcements (hidden ones are excluded by the
 * backend). Data is shared from the resident shell's dashboard-data provider.
 */
export default function AnnouncementsPage() {
  const { data, isLoading } = useResidentDashboard();
  const [query, setQuery] = useState("");

  const announcements = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.announcements;
    return data.announcements.filter((a) =>
      `${a.titleText} ${a.descriptionContent}`.toLowerCase().includes(q),
    );
  }, [data.announcements, query]);

  return (
    <Box>
      <PageHeader
        title="Announcements"
        subtitle="News, events, and updates from your barangay."
      />

      <Box sx={{ mb: 3, maxWidth: 480 }}>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search announcements"
          label="Search announcements"
        />
      </Box>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : announcements.length === 0 ? (
        <EmptyState
          title={query ? "No matching announcements" : "No announcements yet"}
          description={
            query
              ? "Try a different search term."
              : "Check back later for barangay updates and community news."
          }
        />
      ) : (
        <Grid container spacing={2}>
          {announcements.map((announcement) => (
            <Grid
              item
              key={announcement.announcementId ?? announcement._id}
              xs={12}
              sm={6}
              lg={4}
            >
              <AnnouncementCard
                announcement={announcement}
                href={`/announcements/${encodeURIComponent(
                  announcement.announcementId ?? announcement._id ?? "",
                )}`}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
