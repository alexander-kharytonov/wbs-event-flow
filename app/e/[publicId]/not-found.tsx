import { Paper, Stack, Typography } from "@mui/material";

export default function PublicEventNotFound() {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, borderRadius: 2 }}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          Event unavailable
        </Typography>
        <Typography color="text.secondary">
          This event could not be found. Check the link and try again.
        </Typography>
      </Stack>
    </Paper>
  );
}
