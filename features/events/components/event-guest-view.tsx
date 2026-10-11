"use client";

import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { DateTime } from "@/components/ui/date-time";
import { EventCoverBackdrop } from "@/features/events/components/event-cover";
import { EventRichContent } from "@/features/events/components/event-rich-content";
import {
  registrationAvailability,
  registrationDeadline,
} from "@/features/events/registration-availability";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export function EventGuestView({
  snapshot,
  content,
  cover,
  cancelled = false,
  cancellationReason,
  now,
  occupied,
  children,
  notice,
  showApplicationLink = false,
  applicationLinkLabel,
  applicationLinkHref = "#event-application",
}: {
  content?: ReactNode;
  cover?: ReactNode;
  cancelled?: boolean;
  cancellationReason?: string | null;
  snapshot: EventSnapshot;
  now: Date;
  occupied?: number;
  children?: ReactNode;
  notice?: ReactNode;
  showApplicationLink?: boolean;
  applicationLinkLabel?: ReactNode;
  applicationLinkHref?: string;
}) {
  const t = useTranslations("events");
  const formatter = useFormatter();
  const state = cancelled ? "CLOSED" : registrationAvailability(snapshot, now);
  const hasEnded = now.getTime() >= Date.parse(snapshot.endsAt);
  const location = snapshot.location;
  const publicOrganizer = snapshot.publicOrganizer;
  const hasStarted = now.getTime() >= Date.parse(snapshot.startsAt);
  const format = (instant: string) =>
    formatter.dateTime(new Date(instant), {
      timeZone: snapshot.timezone,
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <Box>
      <Stack spacing={3} sx={{ overflowWrap: "anywhere" }}>
        <Paper
          variant="outlined"
          sx={{
            overflow: "hidden",
            position: "relative",
            bgcolor: "background.paper",
            color: cover ? "#fff" : undefined,
            borderTop: cover ? undefined : 3,
            borderTopColor: "primary.main",
          }}
        >
          {cover && <EventCoverBackdrop>{cover}</EventCoverBackdrop>}
          <Stack
            spacing={1.5}
            sx={{
              position: "relative",
              p: { xs: 2.5, sm: 4 },
              aspectRatio: { xs: "auto", lg: cover ? "16 / 9" : "auto" },
              justifyContent: "flex-end",
            }}
          >
            <Typography
              variant="overline"
              color={cover ? "inherit" : "primary.main"}
            >
              {cancelled
                ? t("eventCancelled")
                : hasEnded
                  ? t("pastEvent")
                  : hasStarted
                    ? t("happeningNow")
                    : t("upcomingEvent")}
            </Typography>
            <Typography
              variant="h3"
              component="h1"
              sx={{ fontSize: { xs: "2rem", sm: "2.75rem" }, maxWidth: "28ch" }}
            >
              {snapshot.title}
            </Typography>
            {cancelled && (
              <Alert severity="error" sx={{ whiteSpace: "pre-wrap" }}>
                <AlertTitle>{t("eventCancelled")}</AlertTitle>
                {cancellationReason}
              </Alert>
            )}
            <DateTime
              inverse={Boolean(cover)}
              date={snapshot.startsAt}
              endDate={snapshot.endsAt}
              timezone={snapshot.timezone}
            />
            {location && (
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  color: cover ? "rgba(255,255,255,0.85)" : "text.secondary",
                }}
              >
                <PlaceOutlined fontSize="small" />
                <Typography variant="body2">
                  {location.type === "ONLINE"
                    ? location.onlineLabel
                    : location.venueName}
                  {location.type === "HYBRID" && ` · ${location.onlineLabel}`}
                </Typography>
              </Stack>
            )}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{
                gap: 1,
                flexWrap: "wrap",
                alignItems: { sm: "center" },
                pt: 1,
              }}
            >
              {showApplicationLink && (
                <Button
                  component="a"
                  href={applicationLinkHref}
                  variant="contained"
                >
                  {applicationLinkLabel ?? t("applyToAttend")}
                </Button>
              )}
              <Button
                component="a"
                href="#event-registration"
                variant="outlined"
                color={cover ? "inherit" : "primary"}
              >
                {t("registrationDetails")}
              </Button>
            </Stack>
          </Stack>
        </Paper>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "minmax(0, 1fr) 320px",
            },
            gap: { xs: 3, md: 4 },
            alignItems: "start",
          }}
        >
          <Stack
            spacing={3}
            sx={{ minWidth: 0, gridColumn: { md: 2 }, gridRow: { md: 1 } }}
          >
            <Paper
              component="section"
              variant="outlined"
              id="event-registration"
              aria-labelledby="event-registration-title"
              tabIndex={-1}
              sx={{
                p: { xs: 2, sm: 3 },
              }}
            >
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    flexWrap: "wrap",
                  }}
                >
                  <Typography
                    id="event-registration-title"
                    variant="h6"
                    component="h2"
                  >
                    {t("registration")}
                  </Typography>
                  <Chip
                    size="small"
                    label={
                      cancelled
                        ? t("cancelled")
                        : hasEnded
                          ? t("eventEnded")
                          : state === "OPEN"
                            ? t("open")
                            : state === "NOT_OPEN_YET"
                              ? t("notOpenYet")
                              : t("closed")
                    }
                    color={
                      cancelled
                        ? "error"
                        : state === "OPEN"
                          ? "success"
                          : state === "NOT_OPEN_YET"
                            ? "info"
                            : "default"
                    }
                    variant="outlined"
                  />
                </Stack>
                <Box
                  component="dl"
                  sx={{
                    m: 0,
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr)",
                      sm: "repeat(2, minmax(0, 1fr))",
                      md: "minmax(0, 1fr)",
                    },
                    gap: 3,
                    "& dt": {
                      typography: "body2",
                      color: "text.secondary",
                      mb: 0.5,
                    },
                    "& dd": { m: 0, typography: "body1", fontWeight: 600 },
                  }}
                >
                  <Box>
                    <Typography component="dt">
                      {t("registrationOpens")}
                    </Typography>
                    <Typography component="dd">
                      {snapshot.registrationOpensAt
                        ? format(snapshot.registrationOpensAt)
                        : t("onPublication")}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography component="dt">
                      {t("registrationCloses")}
                    </Typography>
                    <Typography component="dd">
                      {format(registrationDeadline(snapshot))}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography component="dt">
                      {!hasEnded &&
                      occupied !== undefined &&
                      snapshot.capacity !== null
                        ? t("placesAvailable")
                        : t("guestCapacity")}
                    </Typography>
                    <Typography component="dd">
                      {snapshot.capacity === null
                        ? t("noLimit")
                        : !hasEnded && occupied !== undefined
                          ? formatter.number(
                              Math.max(0, snapshot.capacity - occupied),
                            )
                          : t("guestsCount", { count: snapshot.capacity })}
                      {!hasEnded &&
                        occupied !== undefined &&
                        snapshot.capacity !== null && (
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5, display: "block", fontWeight: 400 }}
                          >
                            {t("filledPlacesValue", {
                              occupied,
                              capacity: snapshot.capacity,
                            })}
                          </Typography>
                        )}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography component="dt">{t("flowAccount")}</Typography>
                    <Typography component="dd">
                      {snapshot.accountRequirement === "REQUIRED"
                        ? t("verifiedAccountRequired")
                        : t("optional")}
                    </Typography>
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}
                >
                  {t("allTimesIn", { timezone: snapshot.timezone })}{" "}
                  {hasEnded && t("endedRegistrationClosed")}
                  {!hasEnded &&
                    snapshot.capacity !== null &&
                    occupied !== undefined &&
                    occupied >= snapshot.capacity &&
                    state === "OPEN" &&
                    t("fullCanApply")}
                </Typography>
                <Stack
                  spacing={2}
                  sx={{
                    pt: 2,
                    borderTop: 1,
                    borderColor: "divider",
                    "&:empty": { display: "none" },
                  }}
                >
                  {notice}
                </Stack>
              </Stack>
            </Paper>
            {location && (
              <Paper
                variant="outlined"
                sx={{ p: { xs: 2, sm: 3 }, overflowWrap: "anywhere" }}
                component="section"
                aria-labelledby="event-location-title"
              >
                <Stack spacing={1.5}>
                  <Typography
                    id="event-location-title"
                    variant="h6"
                    component="h2"
                  >
                    {t("location")}
                  </Typography>
                  {"venueName" in location && (
                    <>
                      <Typography sx={{ fontWeight: 600 }}>
                        {location.venueName}
                      </Typography>
                      <Typography sx={{ whiteSpace: "pre-wrap" }}>
                        {location.address}
                      </Typography>
                    </>
                  )}
                  {"onlineUrl" in location && (
                    <Link
                      component="a"
                      href={location.onlineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {location.onlineLabel}
                    </Link>
                  )}
                </Stack>
              </Paper>
            )}
            {publicOrganizer && (
              <Paper
                component="section"
                variant="outlined"
                aria-labelledby="event-organizer-title"
                sx={{ p: { xs: 2, sm: 3 } }}
              >
                <Stack spacing={1.5}>
                  <Typography
                    id="event-organizer-title"
                    variant="h6"
                    component="h2"
                  >
                    {t("organizer")}
                  </Typography>
                  <Typography variant="subtitle1" component="p">
                    {publicOrganizer.websiteUrl ? (
                      <Link
                        component="a"
                        href={publicOrganizer.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {publicOrganizer.displayName}
                      </Link>
                    ) : (
                      publicOrganizer.displayName
                    )}
                  </Typography>
                  {publicOrganizer.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ whiteSpace: "pre-wrap" }}
                    >
                      {publicOrganizer.description}
                    </Typography>
                  )}
                </Stack>
              </Paper>
            )}
          </Stack>
          <Stack
            spacing={4}
            useFlexGap
            sx={{ minWidth: 0, gridColumn: { md: 1 }, gridRow: { md: 1 } }}
          >
            {content ?? <EventRichContent snapshot={snapshot} />}
            <Box
              id="event-application"
              tabIndex={-1}
              sx={{
                "&:empty": { display: "none" },
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                p: { xs: 2, sm: 3 },
              }}
            >
              {children}
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
