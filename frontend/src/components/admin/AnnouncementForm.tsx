"use client";

import type { Ref } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CampaignIcon from "@mui/icons-material/Campaign";
import EditIcon from "@mui/icons-material/Edit";
import { MediaUploader } from "@/components/shared/MediaUploader";

/** Priority levels (backend enum values). */
export const ANNOUNCEMENT_PRIORITIES = ["high", "medium", "low"] as const;

/** Human-friendly priority labels. */
export const PRIORITY_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Editable fields for creating or editing an announcement. */
export interface AnnouncementFormValues {
  titleText: string;
  descriptionContent: string;
  priorityLevel: string;
  eventDate: string;
  imageUrl: string;
  isHidden: boolean;
}

/** Fresh, empty form values for the publish state. */
export function emptyAnnouncementForm(): AnnouncementFormValues {
  return {
    titleText: "",
    descriptionContent: "",
    priorityLevel: "low",
    eventDate: "",
    imageUrl: "",
    isHidden: false,
  };
}

/** Convert an ISO date string to a YYYY-MM-DD value for a date input. */
export function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface AnnouncementFormProps {
  /** Which mode the shared form is in. */
  mode: "publish" | "edit";
  /** Current form values. */
  values: AnnouncementFormValues;
  /** Apply a partial change to the form. */
  onChange: (patch: Partial<AnnouncementFormValues>) => void;
  /** Submit the form (creates or updates depending on mode). */
  onSubmit: () => void;
  /** True while a create/update request is in flight. */
  submitting: boolean;
  /** Exit edit mode (rendered only in edit mode). */
  onCancel?: () => void;
  /** Ref for the title input (focused when entering edit mode). */
  titleInputRef?: Ref<HTMLInputElement>;
  /** Ref for the wrapping card (scrolled into view when editing). */
  formCardRef?: Ref<HTMLDivElement>;
}

/**
 * Shared announcement form used both for publishing a new announcement and for
 * editing an existing one. In edit mode the heading, icon, and submit button
 * change so the admin knows they are editing an existing announcement.
 */
export function AnnouncementForm({
  mode,
  values,
  onChange,
  onSubmit,
  submitting,
  onCancel,
  titleInputRef,
  formCardRef,
}: AnnouncementFormProps) {
  const isEdit = mode === "edit";

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }} ref={formCardRef}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          {isEdit ? (
            <EditIcon color="primary" />
          ) : (
            <CampaignIcon color="primary" />
          )}
          <Typography variant="h6" component="h3">
            {isEdit ? "Edit Announcement" : "Publish Announcement"}
          </Typography>
        </Stack>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              inputRef={titleInputRef}
              label="Title"
              value={values.titleText}
              onChange={(e) => onChange({ titleText: e.target.value })}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Event Date"
              type="date"
              value={values.eventDate}
              onChange={(e) => onChange({ eventDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Description"
              value={values.descriptionContent}
              onChange={(e) => onChange({ descriptionContent: e.target.value })}
              fullWidth
              multiline
              minRows={3}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
              <InputLabel id="announcement-priority-label">Priority</InputLabel>
              <Select
                labelId="announcement-priority-label"
                label="Priority"
                value={values.priorityLevel}
                onChange={(e: SelectChangeEvent) =>
                  onChange({ priorityLevel: e.target.value })
                }
              >
                {ANNOUNCEMENT_PRIORITIES.map((priority) => (
                  <MenuItem key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <MediaUploader
              label="Banner Image"
              value={values.imageUrl ? [values.imageUrl] : []}
              onChange={(urls) => onChange({ imageUrl: urls[0] ?? "" })}
              folder="announcements"
              multiple={false}
              maxFiles={1}
              accept="image/*"
              helperText="Optional banner image shown on the announcement card."
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={values.isHidden}
                  onChange={(e) => onChange({ isHidden: e.target.checked })}
                />
              }
              label="Hidden (not visible to residents)"
            />
          </Grid>
        </Grid>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            onClick={onSubmit}
            disabled={
              submitting ||
              !values.titleText.trim() ||
              !values.descriptionContent.trim()
            }
          >
            {submitting
              ? isEdit
                ? "Saving…"
                : "Publishing…"
              : isEdit
                ? "Save Changes"
                : "Publish"}
          </Button>
          {isEdit && (
            <Button variant="outlined" onClick={onCancel} disabled={submitting}>
              Cancel editing
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
