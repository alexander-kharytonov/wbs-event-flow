import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { ArrivalTimeline } from "@/features/events/components/arrival-timeline";
import { EventDescription } from "@/features/events/components/event-description";
import { EventText } from "@/features/events/components/event-text";
import { RegistrationAvailabilityStatus } from "@/features/events/components/registration-availability-status";
import type { EventOverview } from "@/features/events/server/event-overview";

function Metric({
  label,
  value,
  href,
  detail,
}: {
  label: ReactNode;
  value: string | number;
  href: string;
  detail: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardActionArea href={href} sx={{ height: "100%" }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography
            variant="h4"
            component="p"
            sx={{ my: 1, fontWeight: 600 }}
          >
            {typeof value === "number" ? (
              <EventText id="overviewCount" values={{ count: value }} />
            ) : (
              value
            )}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="caption" color="text.secondary">
              {detail}
            </Typography>
            <ArrowForwardIcon sx={{ fontSize: 14, color: "text.secondary" }} />
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export function EventOverviewContent({ data }: { data: EventOverview }) {
  const { lifecycle, active, checkedIn, notArrived } = data;
  const event = data.header.context;
  const base = `/dashboard/events/${event.id}`;
  const attendanceFirst =
    data.full &&
    data.everPublished &&
    (lifecycle === "Ongoing" || lifecycle === "Completed");
  const heading = !data.full ? (
    <EventText id="overviewOperations" />
  ) : !data.everPublished ? (
    <EventText id="overviewPrepare" />
  ) : lifecycle === "Cancelled" ? (
    <EventText id="overviewSummary" />
  ) : attendanceFirst ? (
    lifecycle === "Completed" ? (
      <EventText id="overviewAttendanceSummary" />
    ) : (
      <EventText id="overviewLive" />
    )
  ) : (
    <EventText id="overviewReadiness" />
  );
  const counts = (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      <Metric
        label={<EventText id="overviewActive" />}
        value={active}
        href={`${base}/attendees`}
        detail={<EventText id="overviewOpenAttendees" />}
      />
      <Metric
        label={<EventText id="checkedIn" />}
        value={checkedIn}
        href={`${base}/attendees`}
        detail={<EventText id="overviewOpenAttendees" />}
      />
      <Metric
        label={<EventText id="commAudienceNotArrived" />}
        value={notArrived}
        href={`${base}/attendees`}
        detail={<EventText id="overviewOpenAttendees" />}
      />
    </Box>
  );
  const attendance = (
    <Stack spacing={2}>
      {counts}
      {data.full && attendanceFirst && data.methods && (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 3 }}>
          <Typography>
            <Box component="span" sx={{ fontWeight: 600 }}>
              {data.rate === null ? (
                <EventText id="overviewRateUnavailable" />
              ) : (
                <EventText id="overviewRate" values={{ rate: data.rate }} />
              )}
            </Box>
          </Typography>
          <Typography>
            <EventText id="overviewQr" values={{ count: data.methods.QR }} />
          </Typography>
          <Typography>
            <EventText
              id="overviewManual"
              values={{ count: data.methods.MANUAL }}
            />
          </Typography>
        </Stack>
      )}
      {data.full && data.timeline && (
        <ArrivalTimeline
          {...data.timeline}
          timezone={event.timezone}
          ongoing={lifecycle === "Ongoing"}
        />
      )}
    </Stack>
  );

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <SectionHeader
          title={heading}
          description={
            lifecycle === "Cancelled" ? (
              <EventText id="overviewCancelledHint" />
            ) : attendanceFirst ? (
              <EventText id="overviewAttendanceHint" />
            ) : data.full ? (
              <EventText id="overviewPrepareHint" />
            ) : (
              <EventText id="overviewReceptionHint" />
            )
          }
        />
        {lifecycle === "Ongoing" && !event.archivedAt && (
          <Button
            href={`${base}/check-in`}
            variant="contained"
            endIcon={<ArrowForwardIcon />}
          >
            <EventText id="checkIn" />
          </Button>
        )}
      </Stack>
      {(attendanceFirst || !data.full) && attendance}
      {data.full && (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                alignItems: "center",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Typography
                component="h3"
                variant="subtitle1"
                sx={{ fontWeight: 600 }}
              >
                <EventText id="overviewApplications" />
              </Typography>
              <Button
                href={`${base}/applications`}
                endIcon={<ArrowForwardIcon />}
              >
                {lifecycle === "Completed" || lifecycle === "Cancelled" ? (
                  <EventText id="overviewViewApplications" />
                ) : (
                  <EventText id="overviewReviewApplications" />
                )}
              </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              <EventText
                id="overviewAttempts"
                values={{ count: data.header.applicationCount ?? 0 }}
              />
            </Typography>
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
                  ["PENDING", <EventText key="PENDING" id="commPending" />],
                  ["APPROVED", <EventText key="APPROVED" id="approved" />],
                  ["REJECTED", <EventText key="REJECTED" id="rejected" />],
                  ["WITHDRAWN", <EventText key="WITHDRAWN" id="withdrawn" />],
                ] as const
              ).map(([status, label]) => (
                <Metric
                  key={status}
                  label={label}
                  value={data.applications[status]}
                  href={`${base}/applications`}
                  detail={<EventText id="overviewOpenApplications" />}
                />
              ))}
            </Box>
            {data.publication === "unpublished" ? (
              <Alert severity="info">
                <EventText
                  id={
                    data.everPublished
                      ? "overviewUnpublished"
                      : "overviewNeverPublished"
                  }
                />
              </Alert>
            ) : data.publication === "invalid" ? (
              <Alert severity="warning">
                <EventText id="overviewPolicyUnavailable" />
              </Alert>
            ) : lifecycle === "Cancelled" ||
              lifecycle === "Completed" ||
              event.archivedAt ? (
              <Typography variant="body2" color="text.secondary">
                <EventText id="overviewDecisionsClosed" />
              </Typography>
            ) : (
              data.registration && (
                <RegistrationAvailabilityStatus
                  snapshot={data.registration}
                  now={data.now}
                />
              )
            )}
          </Stack>
        </Paper>
      )}
      {data.full && !attendanceFirst && attendance}
      <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
        <Button
          href={`${base}/attendees`}
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
        >
          <EventText id="overviewOpenAttendees" />
        </Button>
        {lifecycle !== "Ongoing" && (
          <Button href={`${base}/check-in`} endIcon={<ArrowForwardIcon />}>
            <EventText id="overviewOpenCheckIn" />
          </Button>
        )}
      </Stack>
      {data.description && (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{ fontWeight: 600 }}
            gutterBottom
          >
            <EventText id="markdownDescription" />
          </Typography>
          <Box sx={{ maxWidth: "75ch" }}>
            <EventDescription text={data.description} />
          </Box>
        </Paper>
      )}
    </Stack>
  );
}
