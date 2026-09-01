"use client";

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

interface LoadingSkeletonProps {
  /** Number of skeleton rows/cards to render. */
  rows?: number;
}

/**
 * Reusable loading placeholder rendered while resident data is fetching.
 * Mimics the shape of a card list so the layout doesn't jump on load.
 */
export function LoadingSkeleton({ rows = 3 }: LoadingSkeletonProps) {
  return (
    <Box role="status" aria-label="Loading content" sx={{ width: "100%" }}>
      {Array.from({ length: rows }).map((_, index) => (
        <Box
          key={index}
          sx={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            py: 1.5,
            width: "100%",
          }}
        >
          <Skeleton variant="rounded" width={56} height={56} sx={{ flexShrink: 0 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="45%" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </Box>
        </Box>
      ))}
    </Box>
  );
}
