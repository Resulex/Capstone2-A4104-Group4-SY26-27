"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Link from "next/link";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import MapIcon from "@mui/icons-material/Map";
import AttachmentIcon from "@mui/icons-material/Attachment";
import { PageHeader } from "@/components/resident/PageHeader";
import { DetailRow } from "@/components/resident/DetailRow";
import { StatusChip } from "@/components/resident/StatusChip";
import { EmptyState } from "@/components/resident/EmptyState";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";
import { IncidentRecord } from "@/lib/admin";
import { fetchIncidentReport, formatDateTime } from "@/lib/resident";
import { isImageUrl, isVideoUrl, fileNameOf } from "@/lib/uploads";

/**
 * Incident Report Details (`/incidents/{id}`).
 *
 * Fetches a single report (matched by custom `incidentId` or `_id`) and shows
 * a location pin, the category, the automated triage priority, status, the
 * reported timestamp and any evidence media links.
 */
export default function IncidentDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [report, setReport] = useState<IncidentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchIncidentReport(id);
      if (!cancelled) setReport(data);
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <Box sx={{ maxWidth: 860, mx: "auto" }}>
      <PageHeader
        backHref="/incidents"
        title="Incident Details"
        subtitle={report?.incidentCategory}
      />

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !report ? (
        <EmptyState
          title="Incident report not found"
          description="This report may have been removed or you may not have access to it."
          action={
            <Button component={Link} href="/incidents" variant="contained">
              Back to My Reports
            </Button>
          }
        />
      ) : (
        <Grid container spacing={3}>
          {/* Location map placeholder. */}
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Box
                  role="img"
                  aria-label={`Map location for ${report.locationDetails}`}
                  sx={{
                    position: "relative",
                    width: "100%",
                    height: { xs: 180, sm: 220 },
                    borderRadius: 2,
                    overflow: "hidden",
                    background: (theme) =>
                      `linear-gradient(120deg, ${theme.palette.warning.light}33 0%, ${theme.palette.primary.light}22 60%, #ffffff 100%)`,
                    border: 1,
                    borderColor: "divider",
                  }}
                >
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
                      Incident Location
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  {report.locationDetails}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Details. */}
          <Grid item xs={12} md={7}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
                  Details
                </Typography>
                <DetailRow
                  label="Incident Category"
                  value={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {report.incidentCategory}
                    </Typography>
                  }
                />
                <DetailRow
                  label="Triage Priority (Automated)"
                  value={<StatusChip status={report.triagePriority} />}
                />
                <DetailRow
                  label="Incident Status"
                  value={<StatusChip status={report.incidentStatus} />}
                />
                <DetailRow
                  label="Reported At"
                  value={formatDateTime(report.reportedAt)}
                />
                <DetailRow
                  label="Location Details"
                  value={report.locationDetails}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Description + evidence. */}
          <Grid item xs={12} md={5}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
                  Description
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {report.descriptionText}
                </Typography>

                <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
                  Evidence Media
                </Typography>
                {report.evidenceMediaUrls && report.evidenceMediaUrls.length > 0 ? (
                  <Stack spacing={1.5} sx={{ mt: 1 }}>
                    {report.evidenceMediaUrls.map((url, index) => (
                      <Box key={`${url}-${index}`}>
                        {isImageUrl(url) ? (
                          <Link href={url} target="_blank" rel="noopener noreferrer">
                            <Box
                              component="img"
                              src={url}
                              alt={fileNameOf(url)}
                              sx={{
                                width: "100%",
                                maxHeight: 220,
                                objectFit: "cover",
                                borderRadius: 2,
                                border: 1,
                                borderColor: "divider",
                                bgcolor: "action.hover",
                              }}
                            />
                          </Link>
                        ) : isVideoUrl(url) ? (
                          <Box
                            component="video"
                            src={url}
                            controls
                            preload="metadata"
                            sx={{
                              width: "100%",
                              maxHeight: 220,
                              borderRadius: 2,
                              border: 1,
                              borderColor: "divider",
                              bgcolor: "black",
                            }}
                          />
                        ) : (
                          <Link
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: "none" }}
                          >
                            <Typography
                              variant="body2"
                              color="primary"
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                fontWeight: 600,
                                wordBreak: "break-all",
                              }}
                            >
                              <AttachmentIcon sx={{ fontSize: 18 }} />
                              {fileNameOf(url)}
                            </Typography>
                          </Link>
                        )}
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No evidence media attached.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
