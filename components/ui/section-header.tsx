import { Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function SectionHeader({
  title,
  description,
}: {
  title?: ReactNode;
  description?: ReactNode;
}) {
  if (!title && !description) return null;

  return (
    <Stack
      spacing={0.75}
      useFlexGap
      sx={{ minWidth: 0, overflowWrap: "anywhere" }}
    >
      {title && (
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
      )}
      {description && (
        <Typography color="text.secondary" variant="subtitle2">
          {description}
        </Typography>
      )}
    </Stack>
  );
}
