import { Alert, Paper, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registration received | Event Flow",
  robots: { index: false, follow: false },
};

export default function ApplicationSubmittedPage() {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2 }}>
      <Stack spacing={2} sx={{ maxWidth: 760, mx: "auto" }}>
        <Typography variant="h4" component="h1">
          Registration received.
        </Typography>
        <Alert severity="success">
          Your application has been submitted for organizer review.
        </Alert>
      </Stack>
    </Paper>
  );
}
