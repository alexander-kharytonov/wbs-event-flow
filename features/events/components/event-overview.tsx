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
import { ArrivalTimeline } from "@/features/events/components/arrival-timeline";
import { EventDescription } from "@/features/events/components/event-description";
import { RegistrationAvailabilityStatus } from "@/features/events/components/registration-availability-status";
import type { EventOverview } from "@/features/events/server/event-overview";

function Metric({
  label,
  value,
  href,
  detail,
}: {
  label: string;
  value: string | number;
  href: string;
  detail: string;
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
            {value}
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
  const heading = !data.full
    ? "Event operations"
    : !data.everPublished
      ? "Prepare your event"
      : lifecycle === "Cancelled"
        ? "Event summary"
        : attendanceFirst
          ? lifecycle === "Completed"
            ? "Attendance summary"
            : "Live attendance"
          : "Event readiness";
  const counts = (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      <Metric
        label="Active attendees"
        value={active}
        href={`${base}/attendees`}
        detail="Open attendees"
      />
      <Metric
        label="Checked in"
        value={checkedIn}
        href={`${base}/attendees`}
        detail="Open attendees"
      />
      <Metric
        label="Not arrived"
        value={notArrived}
        href={`${base}/attendees`}
        detail="Open attendees"
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
              {data.rate === null ? "—" : `${(data.rate * 100).toFixed(1)}%`}
            </Box>{" "}
            attendance rate
          </Typography>
          <Typography>
            QR <strong>{data.methods.QR}</strong>
          </Typography>
          <Typography>
            Manual <strong>{data.methods.MANUAL}</strong>
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
        <Box>
          <Typography variant="h6" component="h2">
            {heading}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {lifecycle === "Cancelled"
              ? "Admissions are preserved. New check-ins and application decisions are closed."
              : attendanceFirst
                ? "Attendance reflects currently active attendees, including guests."
                : data.full
                  ? "Review applications and prepare your attendee list before the event."
                  : "View active attendees and prepare for check-in."}
          </Typography>
        </Box>
        {lifecycle === "Ongoing" && !event.archivedAt && (
          <Button
            href={`${base}/check-in`}
            variant="contained"
            endIcon={<ArrowForwardIcon />}
          >
            Check-in
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
                Applications & registration
              </Typography>
              <Button
                href={`${base}/applications`}
                endIcon={<ArrowForwardIcon />}
              >
                {lifecycle === "Completed" || lifecycle === "Cancelled"
                  ? "View applications"
                  : "Review applications"}
              </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {data.header.applicationCount} submitted attempts
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
                  ["PENDING", "Pending"],
                  ["APPROVED", "Approved"],
                  ["REJECTED", "Rejected"],
                  ["WITHDRAWN", "Withdrawn"],
                ] as const
              ).map(([status, label]) => (
                <Metric
                  key={status}
                  label={label}
                  value={data.applications[status]}
                  href={`${base}/applications`}
                  detail="Open applications"
                />
              ))}
            </Box>
            {data.publication === "unpublished" ? (
              <Alert severity="info">
                {data.everPublished
                  ? "This event is unpublished."
                  : "This event has not been published yet."}{" "}
                Published capacity and registration availability are
                unavailable.
              </Alert>
            ) : data.publication === "invalid" ? (
              <Alert severity="warning">
                Published registration policy is unavailable. A valid revision
                is required for approvals.
              </Alert>
            ) : lifecycle === "Cancelled" ||
              lifecycle === "Completed" ||
              event.archivedAt ? (
              <Typography variant="body2" color="text.secondary">
                Registration and application decisions are closed.
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
          Open attendees
        </Button>
        {lifecycle !== "Ongoing" && (
          <Button href={`${base}/check-in`} endIcon={<ArrowForwardIcon />}>
            Open check-in
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
            Description
          </Typography>
          <Box sx={{ maxWidth: "75ch" }}>
            <EventDescription
              text={data.description}
              format={data.descriptionFormat}
            />
          </Box>
        </Paper>
      )}
    </Stack>
  );
}
