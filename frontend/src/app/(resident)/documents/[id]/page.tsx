"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Link from "next/link";
import PersonIcon from "@mui/icons-material/Person";
import { PageHeader } from "@/components/resident/PageHeader";
import { DetailRow } from "@/components/resident/DetailRow";
import { TimelineSteps } from "@/components/resident/TimelineSteps";
import { StatusChip } from "@/components/resident/StatusChip";
import { EmptyState } from "@/components/resident/EmptyState";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";
import { useResident } from "@/context/ResidentContext";
import {
  DocumentRequestDetail,
  fetchDocumentRequest,
  formatDisplayDate,
} from "@/lib/resident";
import { fetchSignupBarangay, SignupBarangay } from "@/lib/signup";
import { isImageUrl, fileNameOf } from "@/lib/uploads";

/**
 * Document Request Details (`/documents/{id}`).
 *
 * Fetches a single request (matched by custom `requestId` or `_id`) and shows
 * the applicant details, request metadata, and the processing timeline.
 */
export default function DocumentRequestDetailsPage() {
  const params = useParams<{ id: string }>();
  const { profile } = useResident();
  const id = params.id;

  const [request, setRequest] = useState<DocumentRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [barangays, setBarangays] = useState<SignupBarangay[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchDocumentRequest(id);
      if (!cancelled) setRequest(data);
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Resolve the barangay ObjectId on the profile to its display name so the
  // address shows the barangay name instead of a raw database id.
  useEffect(() => {
    let cancelled = false;
    fetchSignupBarangay()
      .then((list) => {
        if (!cancelled) setBarangays(list);
      })
      .catch(() => {
        /* Address falls back to omitting the barangay segment. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const barangayName = barangays.find((b) => b._id === profile?.barangay)?.name;

  const address = [
    profile?.houseUnitNumber,
    profile?.streetPurokName,
    barangayName,
    profile?.city,
    profile?.province,
    profile?.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Box sx={{ maxWidth: 860, mx: "auto" }}>
      <PageHeader
        backHref="/documents"
        title="Request Details"
        subtitle={request?.documentType}
      />

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !request ? (
        <EmptyState
          title="Request not found"
          description="This document request may have been removed or you may not have access to it."
          action={
            <Button component={Link} href="/documents" variant="contained">
              Back to My Requests
            </Button>
          }
        />
      ) : (
        <Grid container spacing={3}>
          {/* Applicant details. */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <PersonIcon color="primary" />
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                    Applicant Details
                  </Typography>
                </Box>
                <DetailRow
                  label="Full Name"
                  value={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {request.applicantDetails?.fullName ?? `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim()}
                    </Typography>
                  }
                />
                <DetailRow
                  label="Contact Number"
                  value={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {request.applicantDetails?.contactNumber ?? profile?.contactNumber}
                    </Typography>
                  }
                />
                <DetailRow
                  label="Email Address"
                  value={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {request.applicantDetails?.emailAddress ?? profile?.emailAddress}
                    </Typography>
                  }
                />
                {address && <DetailRow label="Address" value={address} />}
              </CardContent>
            </Card>
          </Grid>

          {/* Request metadata. */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
                  Details
                </Typography>
                <DetailRow
                  label="Purpose"
                  value={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {request.purpose}
                    </Typography>
                  }
                />
                <DetailRow
                  label="Current Status"
                  value={<StatusChip status={request.currentStatus} />}
                />
                <DetailRow
                  label="Submission Date"
                  value={formatDisplayDate(request.dateRequested)}
                />
                <DetailRow
                  label="Expected Completion"
                  value={formatDisplayDate(request.expectedCompletionDate)}
                />
                <DetailRow
                  label="Payment Status"
                  value={<StatusChip status={request.paymentStatus ?? "Unpaid"} />}
                />
                {request.officialReceiptNumber && (
                  <DetailRow label="Official Receipt" value={request.officialReceiptNumber} />
                )}

                {request.verificationIdUrl && (
                  <>
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
                      Verification ID
                    </Typography>
                    {isImageUrl(request.verificationIdUrl) ? (
                      <Link
                        href={request.verificationIdUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Box
                          component="img"
                          src={request.verificationIdUrl}
                          alt={fileNameOf(request.verificationIdUrl)}
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
                    ) : (
                      <Link
                        href={request.verificationIdUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <Typography
                          variant="body2"
                          color="primary"
                          sx={{ fontWeight: 600, wordBreak: "break-all" }}
                        >
                          {fileNameOf(request.verificationIdUrl)}
                        </Typography>
                      </Link>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Timeline. */}
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
                  Timeline Progress
                </Typography>
                {request.timeline && request.timeline.length > 0 ? (
                  <TimelineSteps steps={request.timeline} />
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Status:
                    </Typography>
                    <StatusChip status={request.currentStatus} />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
