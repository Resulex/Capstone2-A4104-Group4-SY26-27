"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ImageIcon from "@mui/icons-material/Image";
import MovieIcon from "@mui/icons-material/Movie";
import { uploadMedia, isImageUrl, isVideoUrl, fileNameOf, UploadFolder } from "@/lib/uploads";

interface MediaUploaderProps {
  /** Label shown in the drop zone / pick area. */
  label: string;
  /** Currently uploaded public URLs (controlled). */
  value: string[];
  /** Called with the updated URL list whenever an upload finishes or is removed. */
  onChange: (urls: string[]) => void;
  /** S3 folder/key prefix to upload into (backend allowlist). */
  folder: UploadFolder;
  /** `accept` attribute for the file picker, e.g. "image/*" or "image/*,video/*". */
  accept?: string;
  /** Allow multiple files. Set false for single-file fields (e.g. a photo). */
  multiple?: boolean;
  /** Maximum number of files kept in the list (default 6). */
  maxFiles?: number;
  /** Per-file size cap in MB (default 25). */
  maxSizeMB?: number;
  /** Optional secondary hint shown under the drop zone. */
  helperText?: string;
  /** Disable the whole control. */
  disabled?: boolean;
}

/**
 * Reusable media uploader.
 *
 * Picks file(s), uploads them straight to S3 via the backend's presign
 * endpoint, and reports the resulting public URLs back through `onChange`.
 * Supports single or multiple files, image/video previews, and removal.
 */
export function MediaUploader({
  label,
  value,
  onChange,
  folder,
  accept = "image/*,video/*",
  multiple = true,
  maxFiles = 6,
  maxSizeMB = 25,
  helperText,
  disabled = false,
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const slotsRemaining = Math.max(0, maxFiles - value.length);

  const handleFiles = async (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    setUploadError(null);

    // Single mode always replaces the current value; multiple mode appends up
    // to the remaining slots. Accumulate locally because `value` is stale
    // within this async loop.
    const files = multiple
      ? Array.from(selected).slice(0, slotsRemaining)
      : [selected[0]];
    let accumulated = value;

    for (const file of files) {
      setUploading((prev) => [...prev, file.name]);
      try {
        const publicUrl = await uploadMedia(file, folder, { maxSizeMB });
        accumulated = multiple ? [...accumulated, publicUrl] : [publicUrl];
        onChange(accumulated);
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : `Failed to upload ${file.name}.`,
        );
      } finally {
        setUploading((prev) => prev.filter((name) => name !== file.name));
      }
    }
  };

  const canPick = !disabled && (multiple ? slotsRemaining > 0 : true);

  return (
    <Box>
      {uploadError && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {uploadError}
        </Alert>
      )}

      {/* Uploaded items with previews. */}
      {value.length > 0 && (
        <Stack spacing={1} sx={{ mb: 1.5 }}>
          {value.map((url) => (
            <Box
              key={url}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                p: 1,
                bgcolor: "background.paper",
              }}
            >
              {isImageUrl(url) ? (
                <Box
                  component="img"
                  src={url}
                  alt={fileNameOf(url)}
                  sx={{
                    width: 56,
                    height: 56,
                    objectFit: "cover",
                    borderRadius: 1,
                    bgcolor: "action.hover",
                  }}
                />
              ) : isVideoUrl(url) ? (
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "action.hover",
                    color: "text.secondary",
                  }}
                >
                  <MovieIcon />
                </Box>
              ) : (
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "action.hover",
                    color: "text.secondary",
                  }}
                >
                  <ImageIcon />
                </Box>
              )}
              <Typography
                variant="body2"
                sx={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}
              >
                {fileNameOf(url)}
              </Typography>
              <Tooltip title="Remove">
                <IconButton
                  size="small"
                  aria-label={`Remove ${fileNameOf(url)}`}
                  onClick={() => onChange(value.filter((u) => u !== url))}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Stack>
      )}

      {/* Drop zone / pick button. */}
      <Box
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => canPick && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (canPick) inputRef.current?.click();
          }
        }}
        sx={{
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 2,
          p: 2.5,
          textAlign: "center",
          bgcolor: "action.hover",
          cursor: canPick ? "pointer" : "not-allowed",
          opacity: disabled || !canPick ? 0.6 : 1,
          "&:hover": canPick ? { bgcolor: "action.selected" } : undefined,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.75,
            color: "text.secondary",
            mb: 0.5,
          }}
        >
          <CloudUploadIcon />
          <Typography variant="subtitle2">{label}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {multiple
            ? `Tap to attach up to ${maxFiles} file${maxFiles === 1 ? "" : "s"}.`
            : "Tap to attach one file."}
        </Typography>
        {helperText && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            {helperText}
          </Typography>
        )}
        {uploading.length > 0 && (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="center"
            spacing={1}
            sx={{ mt: 1 }}
          >
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Uploading {uploading[uploading.length - 1]}…
            </Typography>
          </Stack>
        )}
      </Box>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        disabled={!canPick}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </Box>
  );
}
