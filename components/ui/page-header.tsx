import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Stack
      component="header"
      direction={{ xs: "column", sm: "row" }}
      sx={{
        gap: 2,
        justifyContent: "space-between",
        alignItems: { sm: "center" },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{ overflowWrap: "anywhere" }}
        >
          {title}
        </Typography>
        {description && (
          <Typography
            color="text.secondary"
            sx={{ mt: 0.75, maxWidth: "65ch" }}
          >
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
