import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { getSession } from "@/lib/session";

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await getSession();
  const { error } = await searchParams;

  return (
    <Stack spacing={3}>
      {error && (
        <Alert severity="error">
          The verification link is invalid or expired. Sign in to request a new
          verification email.
        </Alert>
      )}
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, borderRadius: 2 }}>
        <Stack spacing={3} sx={{ maxWidth: 640 }}>
          <Typography variant="overline" color="text.secondary">
            For event organizers
          </Typography>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontSize: { xs: "2.25rem", sm: "3rem" },
              fontWeight: 600,
              letterSpacing: "-0.03em",
            }}
          >
            Your next event starts here.
          </Typography>
          <Typography
            variant="h6"
            component="p"
            color="text.secondary"
            sx={{ fontWeight: 400 }}
          >
            Bring the details together with Event Flow. Create a draft, set your
            schedule, and manage your event in one place.
          </Typography>
          {session ? (
            <Button
              href="/dashboard"
              variant="contained"
              sx={{ alignSelf: "flex-start" }}
            >
              Go to dashboard
            </Button>
          ) : (
            <Stack
              component="nav"
              aria-label="Get started"
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
            >
              <Button href="/register" variant="contained">
                Register as an organizer
              </Button>
              <Button href="/sign-in" variant="outlined">
                Sign in
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm: "repeat(3, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        {[
          {
            title: "Start with a draft",
            description:
              "Keep the details together and make changes as your plans take shape.",
          },
          {
            title: "Set the schedule",
            description:
              "Choose event dates and times in the timezone that fits your event.",
          },
          {
            title: "Define registration",
            description:
              "Set guest capacity, registration dates, and account requirements.",
          },
        ].map(({ title, description }) => (
          <Paper
            component="section"
            key={title}
            variant="outlined"
            sx={{ p: 3, borderRadius: 2 }}
          >
            <Stack spacing={1}>
              <Typography
                variant="subtitle1"
                component="h2"
                sx={{ fontWeight: 600 }}
              >
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            </Stack>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}
