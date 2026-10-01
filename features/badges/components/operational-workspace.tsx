"use client";

import PrintOutlined from "@mui/icons-material/PrintOutlined";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  MAX_BADGES_PER_DOCUMENT,
  nextBadgeBatchUrl,
} from "@/features/badges/print-request";
import type { readBadgeWorkspace } from "@/features/badges/server/bulk";

type Workspace = NonNullable<Awaited<ReturnType<typeof readBadgeWorkspace>>>;

export function OperationalBadgeWorkspace({
  eventId,
  data,
  designer,
}: {
  eventId: string;
  data: Workspace;
  designer: ReactNode;
}) {
  const router = useRouter();
  const [section, setSection] = useState(
    data.configure ? "design" : "attendees",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const visible = data.attendees.filter((attendee) =>
    attendee.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const selectedSet = new Set(selected);
  const validSelection =
    selected.length > 0 && selected.length <= MAX_BADGES_PER_DOCUMENT;

  function toggle(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
  }

  function refresh() {
    setSelected([]);
    router.refresh();
  }

  return (
    <Stack spacing={3}>
      <Tabs
        value={section}
        onChange={(_, value) => setSection(value)}
        aria-label="Badge workspace sections"
      >
        {data.configure && (
          <Tab
            value="design"
            label="Design"
            id="badge-design-tab"
            aria-controls="badge-design-panel"
          />
        )}
        <Tab
          value="attendees"
          label="Attendees"
          id="badge-attendees-tab"
          aria-controls="badge-attendees-panel"
        />
        <Tab
          value="team"
          label="Event team"
          id="badge-team-tab"
          aria-controls="badge-team-panel"
        />
      </Tabs>
      {data.configure && (
        <Box
          hidden={section !== "design"}
          role="tabpanel"
          id="badge-design-panel"
          aria-labelledby="badge-design-tab"
        >
          {designer}
        </Box>
      )}
      {section !== "design" && (
        <Typography variant="body2" color="text.secondary">
          Printing always uses the current saved badge design. Unsaved Designer
          changes are not printed.
        </Typography>
      )}
      {data.cancelled && section !== "design" && (
        <Alert severity="info">
          Printing is unavailable for a cancelled event.
        </Alert>
      )}
      {section === "attendees" && (
        <Stack
          spacing={2}
          role="tabpanel"
          id="badge-attendees-panel"
          aria-labelledby="badge-attendees-tab"
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "center" } }}
          >
            <TextField
              size="small"
              label="Search attendees"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ flex: 1 }}
            />
            <Button onClick={refresh}>Refresh list</Button>
          </Stack>
          <Box
            component="form"
            method="post"
            target="_blank"
            rel="noopener"
            action={`/print/events/${eventId}/badges/bulk`}
            onSubmit={(event) => {
              if (!validSelection || data.cancelled) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="mode" value="SELECTED" />
            {selected.map((id) => (
              <input key={id} type="hidden" name="attendeeId" value={id} />
            ))}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ alignItems: { sm: "center" } }}
            >
              <Button
                type="submit"
                variant="contained"
                startIcon={<PrintOutlined />}
                disabled={!validSelection || data.cancelled}
              >
                Print selected
              </Button>
              <Typography variant="body2">
                {selected.length} / {MAX_BADGES_PER_DOCUMENT} selected
              </Typography>
              <Button
                disabled={!selected.length}
                onClick={() => setSelected([])}
              >
                Clear selection
              </Button>
              <Button
                disabled={
                  !visible.length ||
                  new Set([...selected, ...visible.map((person) => person.id)])
                    .size > MAX_BADGES_PER_DOCUMENT
                }
                onClick={() =>
                  setSelected([
                    ...new Set([
                      ...selected,
                      ...visible.map((person) => person.id),
                    ]),
                  ])
                }
              >
                Select visible
              </Button>
            </Stack>
          </Box>
          <Paper variant="outlined" sx={{ maxHeight: 480, overflow: "auto" }}>
            {visible.length ? (
              visible.map((attendee) => (
                <Stack
                  key={attendee.id}
                  direction="row"
                  spacing={1}
                  sx={{
                    px: 2,
                    py: 0.5,
                    alignItems: "center",
                    borderBottom: 1,
                    borderColor: "divider",
                  }}
                >
                  <FormControlLabel
                    sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}
                    control={
                      <Checkbox
                        checked={selectedSet.has(attendee.id)}
                        disabled={
                          !selectedSet.has(attendee.id) &&
                          selected.length >= MAX_BADGES_PER_DOCUMENT
                        }
                        onChange={(_, checked) => toggle(attendee.id, checked)}
                      />
                    }
                    label={
                      <Box component="span">
                        {attendee.name}
                        {attendee.kind === "GUEST" &&
                          attendee.primaryAttendeeName !== null && (
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.secondary"
                              sx={{ display: "block" }}
                            >
                              Guest of {attendee.primaryAttendeeName}
                            </Typography>
                          )}
                      </Box>
                    }
                  />
                  <Chip
                    label={attendee.kind === "GUEST" ? "Guest" : "Primary"}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
              ))
            ) : (
              <Typography sx={{ p: 3 }} color="text.secondary">
                {data.attendees.length
                  ? "No attendees match your search."
                  : "No active attendees are available."}
              </Typography>
            )}
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
              <Typography variant="subtitle1">All active attendees</Typography>
              <Typography variant="body2" color="text.secondary">
                Print up to 200 current active attendees, including guests.
                Search and selection do not limit this action. If more are
                available, use Print next batch in the opened document. Every
                batch checks current data.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<PrintOutlined />}
                href={nextBadgeBatchUrl(eventId)}
                target="_blank"
                rel="noopener noreferrer"
                disabled={data.cancelled || !data.attendees.length}
              >
                Print all active
              </Button>
            </Stack>
          </Paper>
        </Stack>
      )}
      {section === "team" && (
        <Stack
          spacing={2}
          role="tabpanel"
          id="badge-team-panel"
          aria-labelledby="badge-team-tab"
        >
          <Typography variant="body2" color="text.secondary">
            Visual badges for the current event team: name and role, with the
            event name when enabled. No Ticket, QR or registration answers.
          </Typography>
          {data.teamTooLarge ? (
            <Alert severity="info">
              This event team is too large to print in one document.
            </Alert>
          ) : (
            <Paper variant="outlined">
              {data.team.map((person, index) => (
                <Stack
                  // biome-ignore lint/suspicious/noArrayIndexKey: read-only roster deliberately has no staff identifiers
                  key={index}
                  direction="row"
                  sx={{ p: 2, justifyContent: "space-between", gap: 2 }}
                >
                  <Typography sx={{ overflowWrap: "anywhere", minWidth: 0 }}>
                    {person.name}
                  </Typography>
                  <Chip size="small" label={person.role} variant="outlined" />
                </Stack>
              ))}
            </Paper>
          )}
          <Button
            variant="contained"
            startIcon={<PrintOutlined />}
            href={`/print/events/${eventId}/badges/bulk?mode=TEAM`}
            target="_blank"
            rel="noopener noreferrer"
            disabled={data.cancelled || data.teamTooLarge || !data.team.length}
            sx={{ alignSelf: "flex-start" }}
          >
            Print event team
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
