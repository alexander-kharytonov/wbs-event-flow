"use client";

import ArrowForward from "@mui/icons-material/ArrowForward";
import EventOutlined from "@mui/icons-material/EventOutlined";
import TaskAlt from "@mui/icons-material/TaskAlt";
import {
  Box,
  Button,
  CardActionArea,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useFormatter, useTranslations } from "next-intl";
import { DateTime } from "@/components/ui/date-time";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { CreateEventButton } from "@/features/events/components/create-event-button";
import { OverviewBoundaryRefresh } from "@/features/events/components/overview-boundary-refresh";
import { PublicationStatus } from "@/features/events/components/publication-status";
import { publicationState } from "@/features/events/publication-state";
import type { OrganizerDashboardData } from "@/features/events/server/organizer-dashboard";

export function OrganizerDashboard({ data }: { data: OrganizerDashboardData }) {
  const t = useTranslations("events");
  const shell = useTranslations("shell");
  const format = useFormatter();

  return (
    <Stack spacing={4}>
      <OverviewBoundaryRefresh boundaryAt={data.boundaryAt} />
      <PageHeader
        title={shell("dashboard")}
        description={t("organizerDashboardDescription")}
      />
      <Stack spacing={2} component="section">
        <SectionHeader title={t("quickActions")} />
        <Stack direction="row" useFlexGap sx={{ gap: 1.5, flexWrap: "wrap" }}>
          {data.canCreate && <CreateEventButton />}
          {data.canCreate && (
            <Button href="/dashboard/events" variant="outlined">
              {t("myEvents")}
            </Button>
          )}
          {data.hasStaffEvents && (
            <Button href="/dashboard/staff" variant="outlined">
              {t("staffEvents")}
            </Button>
          )}
          {!data.canCreate && (
            <Button href="/onboarding/organizer" variant="outlined">
              {t("becomeOrganizer")}
            </Button>
          )}
        </Stack>
      </Stack>
      {data.canCreate ? (
        <>
          <Stack spacing={2} component="section">
            <SectionHeader
              title={t("dashboardEventOverview")}
              description={t("ownedMetricsHint")}
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(4, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {(
                [
                  ["upcoming", "upcoming"],
                  ["ongoing", "ongoing"],
                  ["completed", "completed"],
                  ["pending", "awaitingReview"],
                ] as const
              ).map(([key, label]) => (
                <Paper
                  key={key}
                  variant="outlined"
                  sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}
                >
                  <Typography variant="h4" component="p">
                    {format.number(data.metrics[key])}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {t(label)}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Stack>
          <Stack spacing={2} component="section">
            <SectionHeader
              title={t("requiresAttention")}
              description={t("requiresAttentionHint")}
            />
            {data.attention.length ? (
              <Stack
                component="ul"
                spacing={1.5}
                sx={{ listStyle: "none", p: 0, m: 0 }}
              >
                {data.attention.map((event) => (
                  <Paper
                    component="li"
                    key={event.id}
                    variant="outlined"
                    sx={{ p: { xs: 2, sm: 3 } }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      sx={{
                        gap: 2,
                        alignItems: { sm: "center" },
                        justifyContent: "space-between",
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          component="h3"
                          variant="h6"
                          sx={{ overflowWrap: "anywhere" }}
                        >
                          {event.title}
                        </Typography>
                        <Typography color="text.secondary">
                          {t("pendingReviewCount", { count: event.pending })}
                        </Typography>
                      </Box>
                      <Button
                        href={`/dashboard/events/${event.id}/applications`}
                        endIcon={<ArrowForward />}
                        sx={{
                          flexShrink: 0,
                          alignSelf: { xs: "flex-start", sm: "center" },
                        }}
                        aria-label={t("reviewEventApplications", {
                          title: event.title,
                        })}
                      >
                        {t("reviewApplications")}
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <EmptyState
                icon={<TaskAlt />}
                title={t("nothingAwaitingReview")}
                description={t("nothingAwaitingReviewHint")}
              />
            )}
          </Stack>
          <Stack spacing={2} component="section">
            <SectionHeader
              title={t("upcomingEvents")}
              description={t("upcomingEventsHint")}
            />
            {data.upcoming.length ? (
              <Stack
                component="ul"
                spacing={2}
                sx={{ listStyle: "none", p: 0, m: 0 }}
              >
                {data.upcoming.map((event) => (
                  <Paper
                    component="li"
                    key={event.id}
                    variant="outlined"
                    sx={{ overflow: "hidden" }}
                  >
                    <CardActionArea
                      href={`/dashboard/events/${event.id}`}
                      aria-labelledby={`upcoming-event-${event.id}`}
                      sx={{ p: { xs: 2, sm: 3 }, borderRadius: "inherit" }}
                    >
                      <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
                        <Stack
                          direction="row"
                          sx={{
                            gap: 2,
                            flexWrap: "wrap",
                            justifyContent: "space-between",
                            width: "100%",
                            alignItems: "center",
                          }}
                        >
                          <Typography
                            id={`upcoming-event-${event.id}`}
                            component="h3"
                            variant="h6"
                            sx={{ overflowWrap: "anywhere", minWidth: 0 }}
                          >
                            {event.title}
                          </Typography>
                          <PublicationStatus state={publicationState(event)} />
                        </Stack>
                        <DateTime
                          date={event.startsAt}
                          endDate={event.endsAt}
                          timezone={event.timezone}
                        />
                        {event.pending > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            {t("pendingReviewCount", { count: event.pending })}
                          </Typography>
                        )}
                      </Stack>
                    </CardActionArea>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <EmptyState
                icon={<EventOutlined />}
                title={t("noUpcomingEvents")}
                description={t("noUpcomingEventsHint")}
                action={<CreateEventButton />}
              />
            )}
          </Stack>
        </>
      ) : (
        <EmptyState
          icon={<EventOutlined />}
          title={t(data.hasStaffEvents ? "staffDashboardTitle" : "firstEvent")}
          description={t(
            data.hasStaffEvents ? "staffDashboardHint" : "createDraftHint",
          )}
        />
      )}
    </Stack>
  );
}
