"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Alert from "@mui/material/Alert";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import BadgeIcon from "@mui/icons-material/Badge";
import PhoneIcon from "@mui/icons-material/Phone";
import { useResident } from "@/context/ResidentContext";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { BARANGAY_CONTACT, latestAnnouncements } from "@/lib/resident";
import { BrandHero } from "@/components/resident/BrandHero";
import { SectionCard } from "@/components/resident/SectionCard";
import { QuickActionCard } from "@/components/resident/QuickActionCard";
import { AnnouncementCard } from "@/components/resident/AnnouncementCard";
import { LocationCard } from "@/components/resident/LocationCard";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";
import { EmptyState } from "@/components/resident/EmptyState";

/**
 * Resident Dashboard (`/`).
 *
 * Composes the reusable resident components into the Figma "Resident Home"
 * layout: a branding hero, a Quick Actions grid, the latest announcements, and
 * the barangay location. Data is shared from the resident shell's
 * dashboard-data provider (fetched once from the backend list endpoints).
 */
export default function ResidentDashboardPage() {
  const { profile } = useResident();
  const { data, isLoading, error } = useResidentDashboard();

  const quickActions = [
    {
      title: "Submit an Incident Report",
      description:
        "Easily report accidents, emergencies, or public concerns and track their progress until resolved.",
      href: "/incidents/new",
      icon: <WarningAmberIcon />,
      color: "warning.main",
    },
    {
      title: "Track Requests",
      description: "Monitor the status of your document requests and get updates.",
      href: "/documents",
      icon: <TrackChangesIcon />,
      color: "primary.main",
    },
    {
      title: "New Document Request",
      description: "Apply for barangay clearance online.",
      href: "/documents/new",
      icon: <NoteAddIcon />,
      color: "secondary.main",
    },
    {
      title: "View Officials",
      description: "Contact information of barangay officials.",
      href: "/officials",
      icon: <BadgeIcon />,
      color: "info.main",
    },
    {
      title: "Emergency Hotline",
      description: `Call: ${BARANGAY_CONTACT.emergencyHotline}`,
      href: "tel:+6321234567",
      icon: <PhoneIcon />,
      color: "error.main",
    },
  ];

  const announcements = latestAnnouncements(data.announcements, 3);

  return (
    <Box>
      {/* Branding hero (full-bleed on mobile, rounded within padding on desktop). */}
      <BrandHero
        residentName={profile?.firstName}
        phone={BARANGAY_CONTACT.hotline}
        address={BARANGAY_CONTACT.address}
      />

      {/* Section padding (main has none on mobile so the hero can bleed edge-to-edge). */}
      <Box sx={{ px: { xs: 2, sm: 0 }, pb: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {/* Quick Actions */}
        <SectionCard
          title="Quick Actions"
          subtitle="Common barangay services at your fingertips"
          sx={{ mt: 2 }}
        >
          {isLoading ? (
            <LoadingSkeleton rows={3} />
          ) : (
            <Grid container spacing={2}>
              {quickActions.map((action) => (
                <Grid item key={action.title} xs={12} sm={6} lg={4}>
                  <QuickActionCard
                    title={action.title}
                    description={action.description}
                    href={action.href}
                    icon={action.icon}
                    color={action.color}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </SectionCard>

        {/* Latest Announcements */}
        <SectionCard
          title="Latest Announcements"
          actionHref="/announcements"
          actionLabel="See All"
          sx={{ mt: 3 }}
        >
          {isLoading ? (
            <LoadingSkeleton rows={3} />
          ) : announcements.length === 0 ? (
            <EmptyState
              title="No announcements yet"
              description="Check back later for barangay updates and community news."
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
                    href={`/announcements/${announcement.announcementId ?? announcement._id}`}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </SectionCard>

        {/* Location */}
        <SectionCard title="Location" sx={{ mt: 3 }}>
          <LocationCard
            address={BARANGAY_CONTACT.address}
            phone={BARANGAY_CONTACT.hotline}
            mapsUrl={BARANGAY_CONTACT.mapsUrl}
          />
        </SectionCard>
      </Box>
    </Box>
  );
}
