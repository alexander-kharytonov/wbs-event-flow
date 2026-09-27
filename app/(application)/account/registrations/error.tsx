"use client";

import { Alert, Button, Stack } from "@mui/material";

export default function RegistrationsError({ retry }: { retry: () => void }) {
  return (
    <Stack spacing={2}>
      <Alert severity="error">
        We couldn’t load your registrations. Please try again.
      </Alert>
      <Button onClick={retry} sx={{ alignSelf: "flex-start" }}>
        Try again
      </Button>
    </Stack>
  );
}
