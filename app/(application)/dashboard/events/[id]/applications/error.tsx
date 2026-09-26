"use client";

import { Alert, Button, Stack } from "@mui/material";

export default function ApplicationsError({ reset }: { reset: () => void }) {
  return (
    <Stack spacing={2}>
      <Alert severity="error">
        We couldn’t load applications. Please try again.
      </Alert>
      <Button onClick={reset} sx={{ alignSelf: "flex-start" }}>
        Try again
      </Button>
    </Stack>
  );
}
