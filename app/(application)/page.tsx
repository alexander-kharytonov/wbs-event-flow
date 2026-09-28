import ArrowForward from "@mui/icons-material/ArrowForward";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await getSession();
  const organizer = session
    ? await prisma.organizerProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
    : null;
  const { error } = await searchParams;

  return (
    <Stack spacing={3}>
      {error && (
        <Alert severity="error">
          The verification link is invalid or expired.{" "}
          <Button href="/verify-email">Request a new link</Button>
        </Alert>
      )}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, sm: 6, md: 8 },
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            right: -100,
            top: -120,
            width: 420,
            height: 420,
            background:
              "linear-gradient(145deg, var(--mui-palette-primary-main), var(--mui-palette-info-main) 48%, var(--mui-palette-secondary-main))",
            opacity: 0.14,
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
        <Stack spacing={3} sx={{ maxWidth: 690, position: "relative" }}>
          <Typography variant="overline" color="primary.main">
            Make room for your next experience
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: "2.6rem", sm: "3.8rem", md: "4.5rem" },
              fontWeight: 650,
              lineHeight: 1.08,
              letterSpacing: "-0.055em",
            }}
          >
            Good things happen
            <br />
            when people meet.
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ fontSize: { xs: "1rem", sm: "1.15rem" }, maxWidth: 530 }}
          >
            Discover events, apply to attend, and keep your plans together. Your
            next experience starts here.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ alignItems: { sm: "center" }, pt: 1 }}
          >
            <Button
              href="/e"
              variant="contained"
              endIcon={<ArrowForward />}
              size="large"
            >
              Explore events
            </Button>
            <Button
              href={session ? "/account/registrations" : "/register"}
              size="large"
            >
              {session ? "My registrations" : "Create an account"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr" },
          gap: 3,
        }}
      >
        <Paper
          component="section"
          variant="outlined"
          sx={{ p: { xs: 3, sm: 4 } }}
        >
          <Stack spacing={2}>
            <EventAvailableOutlined
              sx={{ color: "secondary.main", fontSize: 32 }}
            />
            <Typography variant="h5" component="h2">
              Bring people together.
            </Typography>
            <Typography color="text.secondary">
              Create your event, build a registration form, and review
              applications in one place. Start with a draft and publish when
              you’re ready.
            </Typography>
            <Button
              href={
                session
                  ? organizer
                    ? "/dashboard"
                    : "/onboarding/organizer"
                  : "/register?returnTo=%2Fonboarding%2Forganizer"
              }
              variant="outlined"
              color="secondary"
              endIcon={<ArrowForward />}
              sx={{ alignSelf: "flex-start" }}
            >
              {organizer ? "Open organizer workspace" : "Start organizing"}
            </Button>
          </Stack>
        </Paper>
        <Stack
          component="section"
          aria-label="How to attend"
          spacing={3}
          sx={{ p: { xs: 2, sm: 4 } }}
        >
          {[
            [
              "01",
              "Find something for you",
              "Explore published events and check the schedule.",
            ],
            [
              "02",
              "Apply to attend",
              "Complete the registration form for organizer review.",
            ],
            [
              "03",
              "Stay in the loop",
              "Get your application updates by email.",
            ],
          ].map(([number, title, description]) => (
            <Stack key={number} direction="row" spacing={2}>
              <Typography
                color="primary.main"
                sx={{ fontSize: "0.8rem", fontWeight: 700, pt: 0.5 }}
              >
                {number}
              </Typography>
              <Box>
                <Typography
                  component="h2"
                  variant="subtitle1"
                  sx={{ fontWeight: 600 }}
                >
                  {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {description}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
