import { Box, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 } }}>
      <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center" }}>
        <Box
          sx={{ color: "text.secondary", mb: 0.5, "& svg": { fontSize: 36 } }}
        >
          {icon}
        </Box>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: "48ch" }}>
          {description}
        </Typography>
        {action && <Box sx={{ pt: 1 }}>{action}</Box>}
      </Stack>
    </Paper>
  );
}
