"use client";

import { Box, Slider, Stack, Typography } from "@mui/material";
import { useId, useRef } from "react";
import {
  type CoverCrop,
  coverCropRectangle,
} from "@/features/events/cover-crop";

export type CoverSource = { url: string; width: number; height: number };

export function CoverCropper({
  source,
  crop,
  onChange,
  disabled,
}: {
  source: CoverSource;
  crop: CoverCrop;
  onChange: (crop: CoverCrop) => void;
  disabled: boolean;
}) {
  const rect = coverCropRectangle(source.width, source.height, crop);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    crop: CoverCrop;
  } | null>(null);
  const id = useId();
  const clamp = (value: number) => Math.max(0, Math.min(1, value));

  return (
    <Stack spacing={2}>
      <Box
        role="group"
        aria-label="Cover crop preview"
        aria-describedby={`${id}-hint`}
        onPointerDown={(event) => {
          if (
            disabled ||
            (event.pointerType === "mouse" && event.button !== 0)
          ) {
            return;
          }

          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            pointer: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            crop,
          };
        }}
        onPointerMove={(event) => {
          const start = drag.current;

          if (!start || disabled || start.pointer !== event.pointerId) {
            return;
          }

          const bounds = event.currentTarget.getBoundingClientRect();
          onChange({
            ...crop,
            x:
              source.width === rect.width
                ? 0.5
                : clamp(
                    start.crop.x -
                      (((event.clientX - start.x) / bounds.width) *
                        rect.width) /
                        (source.width - rect.width),
                  ),
            y:
              source.height === rect.height
                ? 0.5
                : clamp(
                    start.crop.y -
                      (((event.clientY - start.y) / bounds.height) *
                        rect.height) /
                        (source.height - rect.height),
                  ),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        sx={{
          aspectRatio: "16 / 9",
          position: "relative",
          overflow: "hidden",
          bgcolor: "action.disabledBackground",
          borderRadius: 1,
          touchAction: "none",
          cursor: disabled ? "default" : "grab",
          "&:active": { cursor: disabled ? "default" : "grabbing" },
          outline: "1px solid",
          outlineColor: "divider",
        }}
      >
        <Box
          component="img"
          src={source.url}
          alt="Selected cover crop"
          draggable={false}
          sx={{
            position: "absolute",
            maxWidth: "none",
            width: `${(source.width / rect.width) * 100}%`,
            height: `${(source.height / rect.height) * 100}%`,
            left: `${(-rect.left / rect.width) * 100}%`,
            top: `${(-rect.top / rect.height) * 100}%`,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            border: "2px solid rgba(255,255,255,.8)",
            backgroundImage:
              "linear-gradient(to right, transparent 33.1%, rgba(255,255,255,.5) 33.1%, rgba(255,255,255,.5) 33.4%, transparent 33.4%, transparent 66.5%, rgba(255,255,255,.5) 66.5%, rgba(255,255,255,.5) 66.8%, transparent 66.8%), linear-gradient(to bottom, transparent 33.1%, rgba(255,255,255,.5) 33.1%, rgba(255,255,255,.5) 33.4%, transparent 33.4%, transparent 66.5%, rgba(255,255,255,.5) 66.5%, rgba(255,255,255,.5) 66.8%, transparent 66.8%)",
          }}
        />
      </Box>
      <Typography id={`${id}-hint`} variant="body2" color="text.secondary">
        Drag to position your image. Use zoom to adjust the crop. Only the area
        inside this 16:9 frame will be saved.
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
          gap: 3,
          px: 1,
        }}
      >
        {(
          [
            ["zoom", "Zoom", 1, 4, 0.01],
            ["x", "Horizontal position", 0, 1, 0.01],
            ["y", "Vertical position", 0, 1, 0.01],
          ] as const
        ).map(([field, label, min, max, step]) => (
          <Box key={field}>
            <Typography id={`${id}-${field}`} variant="caption">
              {label}
            </Typography>
            <Slider
              aria-labelledby={`${id}-${field}`}
              min={min}
              max={max}
              step={step}
              value={crop[field]}
              disabled={
                disabled ||
                (field === "x" && rect.width === source.width) ||
                (field === "y" && rect.height === source.height)
              }
              onChange={(_, value) =>
                onChange({ ...crop, [field]: value as number })
              }
              valueLabelDisplay="auto"
              valueLabelFormat={(value) =>
                field === "zoom"
                  ? `${value.toFixed(2)}×`
                  : `${Math.round(value * 100)}%`
              }
            />
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
