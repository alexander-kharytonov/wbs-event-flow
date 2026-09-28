import ArrowForward from "@mui/icons-material/ArrowForward";
import EventOutlined from "@mui/icons-material/EventOutlined";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { DateTime } from "@/components/ui/date-time";
import { AccountNavigation } from "@/features/auth/components/account-navigation";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { ApplicationStatus } from "@/features/events/components/application-status";
import { getMyRegistrations } from "@/features/events/server/get-my-registrations";
import { requireVerifiedUser } from "@/lib/session";

export const metadata: Metadata = { title: "My registrations | Event Flow" };

export default async function MyRegistrationsPage() {
  const user = await requireVerifiedUser();
  const { upcoming, past } = await getMyRegistrations(user.id);
  const groups = [
    {
      id: "upcoming-registrations",
      title: "Upcoming",
      registrations: upcoming,
    },
    { id: "past-registrations", title: "Past", registrations: past },
  ];

  return (
    <Stack spacing={3}>
      <ApplicationRealtime streamUrl="/api/account/registrations/stream" />
      <Typography variant="h4" component="h1">
        My registrations
      </Typography>
      <AccountNavigation active="registrations" />
      {upcoming.length === 0 && past.length === 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, borderRadius: 2 }}>
          <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
            <EventOutlined sx={{ fontSize: 40, color: "text.secondary" }} />
            <Typography variant="h6" component="h2">
              No registrations yet
            </Typography>
            <Typography color="text.secondary">
              Browse public events to find something to attend.
            </Typography>
            <Button href="/e" variant="outlined">
              Browse events
            </Button>
          </Stack>
        </Paper>
      ) : (
        groups
          .filter((group) => group.registrations.length > 0)
          .map((group) => (
            <Stack
              key={group.id}
              component="section"
              aria-labelledby={group.id}
              spacing={2}
            >
              <Typography id={group.id} variant="h5" component="h2">
                {group.title}
              </Typography>
              <Box
                component="ul"
                sx={{
                  listStyle: "none",
                  p: 0,
                  m: 0,
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    sm: "repeat(2, minmax(0, 1fr))",
                  },
                }}
              >
                {group.registrations.map((registration) => (
                  <Paper
                    key={registration.publicId}
                    component="li"
                    variant="outlined"
                    sx={{ p: 3, borderRadius: 2 }}
                  >
                    <Stack
                      spacing={2}
                      sx={{
                        height: "100%",
                        alignItems: "flex-start",
                        overflowWrap: "anywhere",
                      }}
                    >
                      <ApplicationStatus status={registration.status} />
                      <Typography variant="h6" component="h3">
                        {registration.title}
                      </Typography>
                      <Box sx={{ flexGrow: 1 }}>
                        <DateTime
                          date={registration.startsAt}
                          endDate={registration.endsAt}
                          timezone={registration.timezone}
                        />
                      </Box>
                      <Button
                        href={`/e/${encodeURIComponent(registration.publicId)}`}
                        endIcon={<ArrowForward />}
                        sx={{ px: 0 }}
                      >
                        View event
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </Stack>
          ))
      )}
    </Stack>
  );
}
