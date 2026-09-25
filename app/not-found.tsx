import { Stack, Typography } from "@mui/material";

export default function NotFound() {
  return (
    <Stack spacing={2} sx={{ textAlign: "center", py: 8 }}>
      <Typography component="h1" variant="h3">
        404
      </Typography>
      <Typography component="h2" variant="h6" color="text.secondary">
        This page could not be found.
      </Typography>
    </Stack>
  );
}
