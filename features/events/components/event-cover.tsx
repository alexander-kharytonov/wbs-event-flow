"use client";

import { Box, Typography } from "@mui/material";
import { useState } from "react";
import type { eventCoverImage } from "@/features/events/event-cover";

export function EventCover({
  image,
}: {
  image: ReturnType<typeof eventCoverImage>;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <Box
      sx={{
        position: "relative",
        aspectRatio: `${image.width} / ${image.height}`,
        maxHeight: { xs: 220, sm: 280 },
        width: "100%",
        bgcolor: "action.hover",
        overflow: "hidden",
      }}
    >
      {failed ? (
        <Typography
          role="status"
          variant="body2"
          color="text.secondary"
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            p: 2,
          }}
        >
          Cover image unavailable
        </Typography>
      ) : (
        <Box
          component="img"
          {...image}
          fetchPriority="high"
          ref={(element: HTMLImageElement | null) => {
            if (element?.complete && element.naturalWidth === 0) {
              setFailed(true);
            }
          }}
          onError={() => setFailed(true)}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      )}
    </Box>
  );
}
