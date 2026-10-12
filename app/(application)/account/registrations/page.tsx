import EventOutlined from "@mui/icons-material/EventOutlined";
import {
  Alert,
  Box,
  Button,
  CardActionArea,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { getTranslations } from "next-intl/server";
import { DateTime } from "@/components/ui/date-time";
import { EmptyState } from "@/components/ui/empty-state";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { ApplicationStatus } from "@/features/events/components/application-status";
import { EventLanguageChip } from "@/features/events/components/event-language-chip";
import { EventText } from "@/features/events/components/event-text";
import { RegistrationAdmission } from "@/features/events/components/registration-admission";
import { getMyRegistrations } from "@/features/events/server/get-my-registrations";
import { requireVerifiedUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("events");

  return { title: `${t("myRegistrations")} | Event Flow` };
}

export default async function MyRegistrationsPage() {
  const user = await requireVerifiedUser();
  const { upcoming, past, unavailable } = await getMyRegistrations(user.id);
  const groups = [
    {
      id: "upcoming-registrations",
      title: <EventText id="upcoming" />,
      registrations: upcoming,
    },
    {
      id: "past-registrations",
      title: <EventText id="past" />,
      registrations: past,
    },
    {
      id: "unavailable-registrations",
      title: <EventText id="registrationsUnavailable" />,
      registrations: unavailable,
    },
  ];

  return (
    <Stack spacing={3}>
      <ApplicationRealtime streamUrl="/api/account/registrations/stream" />
      <Stack spacing={0.75}>
        <Typography variant="h5" component="h2">
          <EventText id="myRegistrations" />
        </Typography>
        <Typography color="text.secondary">
          <EventText id="myRegistrationsDescription" />
        </Typography>
      </Stack>
      {upcoming.length === 0 &&
      past.length === 0 &&
      unavailable.length === 0 ? (
        <EmptyState
          icon={<EventOutlined />}
          title={<EventText id="registrationsEmpty" />}
          description={<EventText id="registrationsEmptyHint" />}
          action={
            <Button href="/e" variant="contained">
              <EventText id="registrationsBrowse" />
            </Button>
          }
        />
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
                    lg: "repeat(2, minmax(0, 1fr))",
                  },
                }}
              >
                {group.registrations.map((registration) => (
                  <Paper
                    key={registration.eventId}
                    component="li"
                    variant="outlined"
                  >
                    <CardActionArea
                      href={`/account/registrations/${registration.eventId}`}
                      aria-labelledby={`registration-title-${registration.eventId}`}
                      sx={{ p: 3, height: "100%", borderRadius: "inherit" }}
                    >
                      <Stack
                        spacing={2}
                        sx={{
                          height: "100%",
                          alignItems: "flex-start",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {registration.admission ? (
                          <RegistrationAdmission
                            admission={registration.admission}
                            compact
                          />
                        ) : (
                          <ApplicationStatus status={registration.status} />
                        )}
                        {registration.cancelledAt && (
                          <Alert
                            severity="error"
                            sx={{ whiteSpace: "pre-wrap", width: "100%" }}
                          >
                            <EventText id="registrationsCancelled" />
                            {registration.cancellationReason}
                          </Alert>
                        )}
                        <Typography
                          id={`registration-title-${registration.eventId}`}
                          variant="h6"
                          component="h3"
                        >
                          {registration.title ?? (
                            <EventText id="registrationsEventUnavailable" />
                          )}
                        </Typography>
                        {registration.language && (
                          <EventLanguageChip language={registration.language} />
                        )}
                        <Box sx={{ flexGrow: 1 }}>
                          {registration.startsAt &&
                            registration.endsAt &&
                            registration.timezone && (
                              <DateTime
                                date={registration.startsAt}
                                endDate={registration.endsAt}
                                timezone={registration.timezone}
                              />
                            )}
                        </Box>
                      </Stack>
                    </CardActionArea>
                  </Paper>
                ))}
              </Box>
            </Stack>
          ))
      )}
    </Stack>
  );
}
