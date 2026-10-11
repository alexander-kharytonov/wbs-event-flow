"use client";

import ArrowForward from "@mui/icons-material/ArrowForward";
import EventOutlined from "@mui/icons-material/EventOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Box,
  Button,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DateTime } from "@/components/ui/date-time";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CatalogLanguageFilter } from "@/features/events/components/catalog-language-filter";
import {
  EventCover,
  EventCoverBackdrop,
} from "@/features/events/components/event-cover";
import { EventDescription } from "@/features/events/components/event-description";
import { EventLanguageChip } from "@/features/events/components/event-language-chip";
import { PublicEventCard } from "@/features/events/components/public-event-card";
import { RegistrationAvailabilityStatus } from "@/features/events/components/registration-availability-status";
import { eventCoverImage } from "@/features/events/event-cover";
import type { EventLanguage } from "@/features/events/event-language";
import type { getPublicEvents } from "@/features/events/server/get-public-events";

export function PublicEventResults({
  publishedEvents,
  language,
  now,
}: {
  publishedEvents: Awaited<ReturnType<typeof getPublicEvents>>;
  language?: EventLanguage;
  now: Date;
}) {
  const t = useTranslations("events");
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const events = publishedEvents.filter(({ snapshot }) =>
    snapshot.title.toLowerCase().includes(query),
  );
  const instant = now.getTime();
  // The catalog is ordered by published start time, earliest first.
  const featured = events.find(
    ({ snapshot }) => Date.parse(snapshot.startsAt) > instant,
  );
  const remainingEvents = events.filter(
    (event) => event.publicId !== featured?.publicId,
  );
  const groups = [
    {
      id: "upcoming-events",
      title: t("upcomingEvents"),
      events: remainingEvents.filter(
        ({ snapshot }) => Date.parse(snapshot.startsAt) > instant,
      ),
    },
    {
      id: "ongoing-events",
      title: t("happeningNow"),
      events: remainingEvents.filter(
        ({ snapshot }) =>
          Date.parse(snapshot.startsAt) <= instant &&
          instant < Date.parse(snapshot.endsAt),
      ),
    },
    {
      id: "past-events",
      title: t("pastEvents"),
      events: remainingEvents.filter(
        ({ snapshot }) => Date.parse(snapshot.endsAt) <= instant,
      ),
    },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader
        title={t("publicEvents")}
        description={t("catalogDescription")}
      />
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: "repeat(2, minmax(0, 1fr))",
          },
        }}
      >
        <TextField
          label={t("searchEvents")}
          placeholder={t("eventTitle")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 0 }}
        />
        <CatalogLanguageFilter language={language} />
      </Box>
      {featured && (
        <Paper
          component="section"
          aria-labelledby="featured-event-title"
          variant="outlined"
          sx={{
            p: { xs: 2.5, sm: 4 },
            aspectRatio: {
              xs: "auto",
              lg: featured.snapshot.cover ? "16 / 9" : "auto",
            },
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            position: "relative",
            overflow: "hidden",
            color: featured.snapshot.cover ? "#fff" : undefined,
            borderTop: featured.snapshot.cover ? undefined : 3,
            borderTopColor: "primary.main",
          }}
        >
          {featured.snapshot.cover && (
            <EventCoverBackdrop>
              <EventCover
                key={featured.snapshot.cover.assetId}
                fill
                priority
                image={{
                  ...eventCoverImage(
                    featured.snapshot.cover,
                    `/e/${featured.publicId}/cover/${featured.snapshot.cover.assetId}`,
                  ),
                  sizes: "(min-width: 1200px) 1152px, calc(100vw - 32px)",
                }}
              />
            </EventCoverBackdrop>
          )}
          <Box
            sx={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 320px" },
              gap: 3,
            }}
          >
            <Stack spacing={2}>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  color: featured.snapshot.cover ? "inherit" : "primary.main",
                }}
              >
                <EventOutlined fontSize="small" />
                <Typography variant="overline" sx={{ fontWeight: 700 }}>
                  {t("upNext")}
                </Typography>
                <EventLanguageChip
                  language={featured.snapshot.language}
                  inverse={Boolean(featured.snapshot.cover)}
                />
              </Stack>
              <Stack spacing={2}>
                <Typography
                  id="featured-event-title"
                  component="h2"
                  variant="h3"
                  sx={{
                    fontSize: { xs: "2rem", sm: "2rem" },
                    fontWeight: 600,
                    overflowWrap: "anywhere",
                  }}
                >
                  {featured.snapshot.title}
                </Typography>
                {featured.snapshot.description && (
                  <Box
                    sx={{
                      color: featured.snapshot.cover
                        ? "rgba(255,255,255,0.85)"
                        : "text.secondary",
                      "& a": { color: "inherit", textDecoration: "underline" },
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 3,
                      overflow: "hidden",
                      overflowWrap: "anywhere",
                      maxWidth: 640,
                    }}
                  >
                    <EventDescription
                      text={featured.snapshot.description}
                      format={featured.snapshot.descriptionFormat}
                    />
                  </Box>
                )}
              </Stack>
            </Stack>
            <Stack
              spacing={2}
              sx={{
                justifyContent: "center",
                borderLeft: { md: 1 },
                borderColor: {
                  md: featured.snapshot.cover
                    ? "rgba(255,255,255,0.3)"
                    : "divider",
                },
                pl: { md: 3 },
              }}
            >
              <DateTime
                inverse={Boolean(featured.snapshot.cover)}
                date={featured.snapshot.startsAt}
                endDate={featured.snapshot.endsAt}
                timezone={featured.snapshot.timezone}
              />
              <RegistrationAvailabilityStatus
                inverse={Boolean(featured.snapshot.cover)}
                snapshot={featured.snapshot}
                now={now}
              />
              <Button
                href={`/e/${encodeURIComponent(featured.publicId)}`}
                variant="contained"
                endIcon={<ArrowForward />}
                sx={{ alignSelf: "flex-start" }}
              >
                {t("viewEvent")}
              </Button>
            </Stack>
          </Box>
        </Paper>
      )}
      {events.length === 0 ? (
        <EmptyState
          icon={<EventOutlined />}
          title={
            query
              ? t("noMatchingEvents")
              : language
                ? t("noEventsLanguage")
                : t("noPublicEvents")
          }
          description={
            query
              ? t("tryAnotherTitle")
              : language
                ? t("chooseAnotherLanguage")
                : t("checkBackEvents")
          }
        />
      ) : (
        groups
          .filter((group) => group.events.length > 0)
          .map((group) => (
            <Stack
              component="section"
              aria-labelledby={group.id}
              key={group.id}
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
                {group.events.map(({ publicId, snapshot }) => (
                  <PublicEventCard
                    key={publicId}
                    publicId={publicId}
                    snapshot={snapshot}
                    now={now}
                    showAvailability={group.id !== "past-events"}
                  />
                ))}
              </Box>
            </Stack>
          ))
      )}
    </Stack>
  );
}
