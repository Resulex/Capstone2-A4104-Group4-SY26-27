"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { isImageUrl, isVideoUrl, fileNameOf } from "@/lib/uploads";

interface MediaPreviewDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Close handler (Escape and the Close button both call it). */
  onClose: () => void;
  /** The media URLs to browse (images, videos, or any other file). */
  urls: string[];
  /** Item to show first when the dialog opens (default 0). */
  initialIndex?: number;
}

/**
 * Reusable lightbox for a list of media URLs. Shows the selected item large
 * with prev/next navigation, an "n of total" counter, inline video playback,
 * and a fallback link for non-media files. Arrow keys navigate; Escape closes.
 */
export function MediaPreviewDialog({
  open,
  onClose,
  urls,
  initialIndex = 0,
}: MediaPreviewDialogProps) {
  const [index, setIndex] = useState(initialIndex);

  // Snap to the clicked item whenever the dialog opens (or its contents change),
  // and clamp in case the list shrank since the caller captured it.
  useEffect(() => {
    if (open) {
      setIndex(Math.min(Math.max(initialIndex, 0), Math.max(urls.length - 1, 0)));
    }
  }, [open, urls, initialIndex]);

  const total = urls.length;
  const safeIndex = total === 0 ? 0 : Math.min(Math.max(index, 0), total - 1);
  const current = urls[safeIndex];

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(total - 1, i + 1));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      onKeyDown={handleKeyDown}
    >
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}
      >
        <Typography
          variant="subtitle1"
          sx={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}
        >
          {current ? fileNameOf(current) : ""}
        </Typography>
        {total > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
            {safeIndex + 1} of {total}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          bgcolor: "action.hover",
          p: { xs: 1.5, sm: 2 },
        }}
      >
        <IconButton
          onClick={goPrev}
          disabled={safeIndex === 0}
          aria-label="Previous media"
        >
          <ChevronLeftIcon />
        </IconButton>

        <Box
          sx={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            minWidth: 0,
          }}
        >
          {current &&
            (isImageUrl(current) ? (
              <Box
                component="img"
                src={current}
                alt={fileNameOf(current)}
                sx={{
                  maxWidth: "100%",
                  maxHeight: "65vh",
                  objectFit: "contain",
                  borderRadius: 2,
                }}
              />
            ) : isVideoUrl(current) ? (
              <Box
                component="video"
                src={current}
                controls
                sx={{
                  maxWidth: "100%",
                  maxHeight: "65vh",
                  borderRadius: 2,
                  bgcolor: "black",
                }}
              />
            ) : (
              <Stack spacing={1} alignItems="center" sx={{ py: 4 }}>
                <InsertDriveFileIcon sx={{ fontSize: 48 }} color="action" />
                <Link
                  href={current}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    fontWeight: 600,
                  }}
                >
                  Open file
                  <OpenInNewIcon fontSize="small" />
                </Link>
              </Stack>
            ))}
        </Box>

        <IconButton
          onClick={goNext}
          disabled={safeIndex >= total - 1}
          aria-label="Next media"
        >
          <ChevronRightIcon />
        </IconButton>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
