"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CampaignIcon from "@mui/icons-material/Campaign";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { AnnouncementDirtyDialog } from "@/components/admin/AnnouncementDirtyDialog";
import {
  AnnouncementForm,
  AnnouncementFormValues,
  ANNOUNCEMENT_PRIORITIES,
  emptyAnnouncementForm,
  PRIORITY_LABELS,
  toDateInputValue,
} from "@/components/admin/AnnouncementForm";
import { useAuth } from "@/context/AuthContext";
import {
  AnnouncementRecord,
  createAnnouncement,
  fetchAnnouncements,
  updateAnnouncement,
} from "@/lib/admin";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Admin Announcements page — lists all announcements (including hidden ones)
 * and lets an admin publish new ones, edit existing announcements through the
 * shared form, adjust priority, or toggle visibility.
 */
export default function AnnouncementsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementFormValues>(
    emptyAnnouncementForm(),
  );
  /** announcementId currently being edited in the shared form (null = publish). */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Whether the shared form has changes not yet saved. */
  const [dirty, setDirty] = useState(false);
  /** Discard-confirmation target, opened when switching away with unsaved changes. */
  const [pendingAction, setPendingAction] = useState<
    | { type: "edit"; announcement: AnnouncementRecord }
    | { type: "cancel" }
    | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAnnouncements();
        if (!cancelled) setAnnouncements(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load announcements.",
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

  const handleUpdate = async (
    announcement: AnnouncementRecord,
    body: { priorityLevel?: string; isHidden?: boolean },
  ) => {
    setPendingId(announcement.announcementId);
    setActionError(null);
    try {
      const updated = await updateAnnouncement(announcement.announcementId, body);
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.announcementId === announcement.announcementId
            ? { ...a, ...updated }
            : a,
        ),
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update announcement.",
      );
    } finally {
      setPendingId(null);
    }
  };

  /** Reset the shared form to a fresh, empty publish state. */
  const resetToPublish = () => {
    setForm(emptyAnnouncementForm());
    setEditingId(null);
    setDirty(false);
    setPendingAction(null);
  };

  /** Apply a partial change to the shared form and mark it dirty. */
  const handleFormChange = (patch: Partial<AnnouncementFormValues>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  /** Scroll the shared form into view and focus the title field. */
  const scrollToForm = () => {
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    titleInputRef.current?.focus();
  };

  /** Load an announcement into the shared form for editing. */
  const loadAnnouncement = (announcement: AnnouncementRecord) => {
    setForm({
      titleText: announcement.titleText ?? "",
      descriptionContent: announcement.descriptionContent ?? "",
      priorityLevel: announcement.priorityLevel ?? "low",
      eventDate: toDateInputValue(announcement.eventDate),
      imageUrl: announcement.imageUrl ?? "",
      isHidden: announcement.isHidden ?? false,
    });
    setEditingId(announcement.announcementId);
    setDirty(false);
    setPendingAction(null);
  };

  /** Start editing an announcement from the table. */
  const handleEdit = (announcement: AnnouncementRecord) => {
    if (editingId === announcement.announcementId) {
      scrollToForm();
      return;
    }
    if (dirty) {
      setPendingAction({ type: "edit", announcement });
      return;
    }
    loadAnnouncement(announcement);
    scrollToForm();
  };

  /** Exit edit mode, guarding against unsaved changes. */
  const handleCancelEdit = () => {
    if (!editingId) return;
    if (dirty) {
      setPendingAction({ type: "cancel" });
      return;
    }
    resetToPublish();
  };

  /** Confirm discarding unsaved changes (dialog confirm action). */
  const handleDiscard = () => {
    if (pendingAction?.type === "edit") {
      loadAnnouncement(pendingAction.announcement);
      scrollToForm();
    } else {
      resetToPublish();
    }
  };

  /** Keep editing — close the dialog without touching the form. */
  const handleKeep = () => {
    setPendingAction(null);
  };

  /** Create (publish mode) or update (edit mode) from the shared form. */
  const handleSubmit = async () => {
    if (!form.titleText.trim() || !form.descriptionContent.trim()) return;
    const body = {
      titleText: form.titleText.trim(),
      descriptionContent: form.descriptionContent.trim(),
      priorityLevel: form.priorityLevel,
      ...(form.eventDate ? { eventDate: form.eventDate } : {}),
      ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
      isHidden: form.isHidden,
    };
    setSubmitting(true);
    setActionError(null);
    try {
      if (editingId) {
        const updated = await updateAnnouncement(editingId, body);
        setAnnouncements((prev) =>
          prev.map((a) =>
            a.announcementId === editingId ? { ...a, ...updated } : a,
          ),
        );
        setSuccessMessage("Announcement updated.");
      } else {
        const created = await createAnnouncement({
          announcementId: `ann-${Date.now()}`,
          ...body,
        });
        setAnnouncements((prev) => [created, ...prev]);
        setSuccessMessage("Announcement published.");
      }
      resetToPublish();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to save announcement.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Announcements
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage community announcements and their visibility.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <AnnouncementForm
        mode={editingId ? "edit" : "publish"}
        values={form}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        submitting={submitting}
        onCancel={handleCancelEdit}
        titleInputRef={titleInputRef}
        formCardRef={formCardRef}
      />

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <CampaignIcon color="primary" />
            <Typography variant="h6" component="h3">
              Announcements
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
              <CircularProgress aria-label="Loading announcements" />
            </Box>
          ) : announcements.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No announcements found.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="medium" aria-label="Announcements">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      Description
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Visibility</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Event Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {announcements.map((announcement) => (
                    <TableRow key={announcement.announcementId} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {announcement.titleText}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ maxWidth: 260 }}
                        >
                          {announcement.descriptionContent || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                          <Select
                            id={`priority-${announcement.announcementId}`}
                            value={announcement.priorityLevel}
                            disabled={pendingId === announcement.announcementId}
                            onChange={(event: SelectChangeEvent) =>
                              handleUpdate(announcement, {
                                priorityLevel: event.target.value,
                              })
                            }
                          >
                            {ANNOUNCEMENT_PRIORITIES.map((priority) => (
                              <MenuItem key={priority} value={priority}>
                                {PRIORITY_LABELS[priority]}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={announcement.isHidden ? "Hidden" : "Published"}
                          size="small"
                          color={announcement.isHidden ? "default" : "success"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {formatDate(announcement.eventDate)}
                      </TableCell>
                      <TableCell>
                        {formatDate(announcement.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => handleEdit(announcement)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color={
                              announcement.isHidden ? "primary" : "inherit"
                            }
                            startIcon={
                              announcement.isHidden ? (
                                <VisibilityIcon />
                              ) : (
                                <VisibilityOffIcon />
                              )
                            }
                            disabled={pendingId === announcement.announcementId}
                            onClick={() =>
                              handleUpdate(announcement, {
                                isHidden: !announcement.isHidden,
                              })
                            }
                          >
                            {announcement.isHidden ? "Unhide" : "Hide"}
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

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage ?? ""}
      />

      <AnnouncementDirtyDialog
        open={pendingAction !== null}
        onDiscard={handleDiscard}
        onKeep={handleKeep}
      />
    </Box>
  );
}
