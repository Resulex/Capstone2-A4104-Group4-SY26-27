"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Link from "next/link";
import AddIcon from "@mui/icons-material/Add";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { PageHeader } from "@/components/resident/PageHeader";
import { DocumentRequestCard } from "@/components/resident/DocumentRequestCard";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";
import { EmptyState } from "@/components/resident/EmptyState";

/**
 * My Document Requests (`/documents`).
 *
 * Lists the resident's document requests (own records, newest first) with
 * status chips and expected completion dates. Data is shared from the resident
 * shell's dashboard-data provider.
 */
export default function DocumentRequestsPage() {
  const { data, isLoading } = useResidentDashboard();
  const requests = data.documentRequests;

  return (
    <Box>
      <PageHeader
        title="My Document Requests"
        subtitle="Track the status of your barangay document requests."
        action={
          <Button
            component={Link}
            href="/documents/new"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            Request Document
          </Button>
        }
      />

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No document requests yet"
          description="Apply for a barangay document such as a clearance or certificate to get started."
          action={
            <Button
              component={Link}
              href="/documents/new"
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
            >
              Request Document
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2}>
          {requests.map((request) => (
            <Grid item key={request.requestId} xs={12} sm={6} lg={4}>
              <DocumentRequestCard
                request={request}
                href={`/documents/${encodeURIComponent(request.requestId)}`}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
