import { Button, Paper, Stack, Typography } from "@mui/material";
import { ApplicationShell } from "@/components/layout/application-shell";

export default function NotFound() {
  return (
    <ApplicationShell>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, sm: 5 },
          borderRadius: 2,
          maxWidth: 480,
          width: "100%",
          mx: "auto",
          my: "auto",
        }}
      >
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <Typography variant="h1" color="text.secondary">
            404
          </Typography>
          <Typography component="h2" variant="h4" align="center">
            Page not found
          </Typography>
          <Typography color="text.secondary" align="center">
            This page could not be found. Check the address or return to the
            home page.
          </Typography>
          <Button href="/" variant="contained">
            Back to home
          </Button>
        </Stack>
      </Paper>
    </ApplicationShell>
  );
}
