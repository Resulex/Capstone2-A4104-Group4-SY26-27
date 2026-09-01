"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import PeopleIcon from "@mui/icons-material/People";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useAuth } from "@/context/AuthContext";
import { fetchResidents, ResidentRecord, updateResident } from "@/lib/admin";

/** Build a resident's full name from its name fields. */
function fullName(resident: ResidentRecord): string {
  const parts = [resident.firstName, resident.middleName, resident.lastName]
    .filter(Boolean)
    .join(" ");
  return parts || "—";
}

/** Address composed from available fields. */
function address(resident: ResidentRecord): string {
  const parts = [resident.houseUnitNumber, resident.streetPurokName, resident.city]
    .filter(Boolean)
    .join(", ");
  return parts || "—";
}

/**
 * Admin Residents page — lists all residents (scoped by role on the backend)
 * with their contact details, address, account status, and provisioning state.
 */
export default function ResidentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [residents, setResidents] = useState<ResidentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  const handleToggleStatus = async (resident: ResidentRecord) => {
    const target = resident.accountStatus === "suspended" ? "active" : "suspended";
    setPendingId(resident.residentId || resident.emailAddress);
    setActionError(null);
    try {
      const updated = await updateResident(resident.residentId, {
        accountStatus: target,
      });
      setResidents((prev) =>
        prev.map((r) =>
          (r.residentId || r.emailAddress) ===
          (resident.residentId || resident.emailAddress)
            ? { ...r, accountStatus: updated.accountStatus }
            : r,
        ),
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update resident status.",
      );
    } finally {
      setPendingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchResidents();
        if (!cancelled) setResidents(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load residents.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Residents
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage and review registered barangay residents.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <PeopleIcon color="primary" />
            <Typography variant="h6" component="h3">
              All Residents
            </Typography>
          </Stack>

          {isLoading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 200,
              }}
            >
              <CircularProgress aria-label="Loading residents" />
            </Box>
          ) : residents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No residents found.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="medium" aria-label="Residents">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Resident</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Provisioned</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {residents.map((resident) => (
                    <TableRow key={resident.residentId || resident.emailAddress} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar
                            sx={{ width: 36, height: 36, bgcolor: "secondary.main", fontSize: 14 }}
                          >
                            {resident.firstName?.[0] ?? "R"}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {fullName(resident)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {resident.residentId}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{resident.emailAddress}</TableCell>
                      <TableCell>{resident.contactNumber ?? "—"}</TableCell>
                      <TableCell>{address(resident)}</TableCell>
                      <TableCell>
                        <Chip
                          label={resident.accountStatus}
                          size="small"
                          color={resident.accountStatus === "active" ? "success" : "error"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={resident.isProvisioned ? "Yes" : "No"}
                          size="small"
                          color={resident.isProvisioned ? "primary" : "default"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() =>
                              router.push(
                                `/admin/residents/${encodeURIComponent(resident.residentId)}/edit`,
                              )
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color={resident.accountStatus === "suspended" ? "success" : "error"}
                            startIcon={
                              resident.accountStatus === "suspended" ? (
                                <CheckCircleIcon />
                              ) : (
                                <BlockIcon />
                              )
                            }
                            disabled={pendingId === (resident.residentId || resident.emailAddress)}
                            onClick={() => handleToggleStatus(resident)}
                          >
                            {resident.accountStatus === "suspended"
                              ? "Unsuspend"
                              : "Suspend"}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={Boolean(actionError)}
        autoHideDuration={6000}
        onClose={() => setActionError(null)}
        message={actionError ?? ""}
      />
    </Box>
  );
}
