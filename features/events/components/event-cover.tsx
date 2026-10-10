"use client";

import { Box, Typography } from "@mui/material";
import { type ReactNode, useState } from "react";
import type { eventCoverImage } from "@/features/events/event-cover";

export function EventCover({
  image,
  fill = false,
  priority = false,
}: {
  image: Pick<ReturnType<typeof eventCoverImage>, "src" | "alt"> &
    Partial<ReturnType<typeof eventCoverImage>>;
  fill?: boolean;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <Box
      sx={{
        position: "relative",
        aspectRatio: fill ? undefined : "16 / 9",
        height: fill ? "100%" : undefined,
        width: "100%",
        flexShrink: 0,
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
          className="event-cover-image"
          {...image}
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
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
            objectFit: "fill",
          }}
        />
      )}
    </Box>
  );
}

export function EventCoverBackdrop({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        bgcolor: "#10131e",
        pointerEvents: "none",
      }}
    >
      {children}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(8, 11, 22, 0.88), rgba(8, 11, 22, 0.65)), linear-gradient(0deg, rgba(8, 11, 22, 0.6), transparent)",
        }}
      />
    </Box>
  );
}
