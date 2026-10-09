"use client";

import Add from "@mui/icons-material/Add";
import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EventNoteOutlined from "@mui/icons-material/EventNoteOutlined";
import {
  Alert,
  Button,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useRef } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { EventFormValues } from "@/features/events/event-input-schema";
import type { useFormFeedback } from "@/hooks/use-form-feedback";

type Feedback = ReturnType<typeof useFormFeedback>;

export function richRequiredMissing(values: EventFormValues) {
  const location = values.location;

  return Boolean(
    (location &&
      "venueName" in location &&
      (!location.venueName.trim() || !location.address.trim())) ||
      (location &&
        "onlineLabel" in location &&
        (!location.onlineLabel.trim() || !location.onlineUrl.trim())) ||
      (values.publicOrganizer && !values.publicOrganizer.displayName.trim()) ||
      values.schedule.some((entry) => !entry.title.trim() || !entry.startsAt),
  );
}

export function EventRichFields({
  values,
  setValues,
  feedback,
  disabled,
}: {
  values: EventFormValues;
  setValues: React.Dispatch<React.SetStateAction<EventFormValues>>;
  feedback: Feedback;
  disabled: boolean;
}) {
  const sequence = useRef(values.schedule.length);
  const agenda = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const location = values.location;
  const organizer = values.publicOrganizer;

  function locationField(
    name: "venueName" | "address" | "onlineLabel" | "onlineUrl",
    label: string,
    maxLength: number,
  ) {
    return (
      <TextField
        key={name}
        label={label}
        required
        fullWidth
        disabled={disabled}
        value={
          location && name in location
            ? String(location[name as keyof typeof location])
            : ""
        }
        onChange={(event) => {
          feedback.clear(`location.${name}`);
          setValues((current) => ({
            ...current,
            location: current.location
              ? { ...current.location, [name]: event.target.value }
              : null,
          }));
        }}
        {...feedback.field(`location.${name}`)}
        slotProps={{ htmlInput: { maxLength } }}
      />
    );
  }

  function changeRow(
    key: string,
    field: "title" | "description" | "startsAt",
    value: string,
  ) {
    feedback.clear(`schedule.${key}.${field}`);
    // A collection-level identity/limit error is not an unrelated row error.
    feedback.setErrors((current) => {
      const next = { ...current };
      delete next.schedule;

      return next;
    });
    setValues((current) => ({
      ...current,
      schedule: current.schedule.map((entry) =>
        entry.key === key
          ? {
              ...entry,
              [field]: value,
              edited: field === "startsAt" ? true : entry.edited,
            }
          : entry,
      ),
    }));
  }

  function move(index: number, offset: number) {
    setValues((current) => {
      const schedule = [...current.schedule];
      [schedule[index], schedule[index + offset]] = [
        schedule[index + offset],
        schedule[index],
      ];

      return { ...current, schedule };
    });
    feedback.setErrors((current) => {
      const next = { ...current };
      delete next.schedule;

      return next;
    });
  }

  return (
    <>
      <input type="hidden" name="location" value={JSON.stringify(location)} />
      <input
        type="hidden"
        name="schedule"
        value={JSON.stringify(values.schedule)}
      />
      <input
        type="hidden"
        name="publicOrganizer"
        value={JSON.stringify(organizer)}
      />
      <Stack component="section" spacing={2}>
        <Typography variant="h6" component="h2">
          Location
        </Typography>
        <TextField
          select
          label="Location type"
          value={location?.type ?? "NONE"}
          disabled={disabled}
          fullWidth
          {...feedback.field("location")}
          onChange={(event) => {
            const type = event.target.value;
            const physical =
              location && "venueName" in location
                ? { venueName: location.venueName, address: location.address }
                : { venueName: "", address: "" };
            const online =
              location && "onlineLabel" in location
                ? {
                    onlineLabel: location.onlineLabel,
                    onlineUrl: location.onlineUrl,
                  }
                : { onlineLabel: "", onlineUrl: "" };
            feedback.clear("location");
            setValues((current) => ({
              ...current,
              location:
                type === "PHYSICAL"
                  ? { type, ...physical }
                  : type === "ONLINE"
                    ? { type, ...online }
                    : type === "HYBRID"
                      ? { type, ...physical, ...online }
                      : null,
            }));
          }}
        >
          <MenuItem value="NONE">Not specified</MenuItem>
          <MenuItem value="PHYSICAL">Physical</MenuItem>
          <MenuItem value="ONLINE">Online</MenuItem>
          <MenuItem value="HYBRID">Hybrid</MenuItem>
        </TextField>
        {location && "venueName" in location && (
          <>
            {locationField("venueName", "Venue name", 200)}
            {locationField("address", "Address", 1000)}
          </>
        )}
        {location && "onlineLabel" in location && (
          <>
            {locationField("onlineLabel", "Online meeting label", 200)}
            {locationField("onlineUrl", "Online meeting URL", 2048)}
          </>
        )}
      </Stack>
      <Stack component="section" spacing={2} ref={agenda}>
        <Typography variant="h6" component="h2">
          Event agenda
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Times use the event timezone. Keep entries in chronological order;
          equal times are allowed. Changing event dates does not shift agenda
          entries.
        </Typography>
        {feedback.errors.schedule && (
          <Alert severity="error">{feedback.errors.schedule}</Alert>
        )}
        {!values.schedule.length && (
          <EmptyState
            icon={<EventNoteOutlined />}
            title="No agenda entries"
            description="Add the sessions or activities you want to share with attendees."
          />
        )}
        {values.schedule.map((entry, index) => (
          <Stack
            key={entry.key}
            data-agenda-key={entry.key}
            spacing={2}
            sx={{
              border: 1,
              borderColor: "divider",
              p: { xs: 2, sm: 3 },
              borderRadius: 1,
            }}
          >
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography component="h3" variant="subtitle1">
                Entry {index + 1}
              </Typography>
              <Stack direction="row">
                <IconButton
                  type="button"
                  aria-label={`Move agenda entry ${index + 1} up`}
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpward />
                </IconButton>
                <IconButton
                  type="button"
                  aria-label={`Move agenda entry ${index + 1} down`}
                  disabled={disabled || index === values.schedule.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownward />
                </IconButton>
                <IconButton
                  type="button"
                  aria-label={`Remove agenda entry ${index + 1}`}
                  disabled={disabled}
                  onClick={() => {
                    const nextKey =
                      values.schedule[index + 1]?.key ??
                      values.schedule[index - 1]?.key;
                    setValues((current) => ({
                      ...current,
                      schedule: current.schedule.filter(
                        (row) => row.key !== entry.key,
                      ),
                    }));
                    feedback.clear(`schedule.${entry.key}`);
                    requestAnimationFrame(() => {
                      const target = nextKey
                        ? agenda.current?.querySelector<HTMLInputElement>(
                            `[data-agenda-key="${nextKey}"] input`,
                          )
                        : null;
                      (target ?? addButton.current)?.focus();
                    });
                  }}
                >
                  <DeleteOutlined />
                </IconButton>
              </Stack>
            </Stack>
            <TextField
              label="Agenda title"
              required
              fullWidth
              disabled={disabled}
              value={entry.title}
              onChange={(event) =>
                changeRow(entry.key, "title", event.target.value)
              }
              {...feedback.field(`schedule.${entry.key}.title`)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <TextField
              label="Agenda start"
              type="datetime-local"
              required
              fullWidth
              disabled={disabled}
              value={entry.startsAt}
              onChange={(event) =>
                changeRow(entry.key, "startsAt", event.target.value)
              }
              {...feedback.field(`schedule.${entry.key}.startsAt`)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Agenda description (optional)"
              multiline
              minRows={2}
              fullWidth
              disabled={disabled}
              value={entry.description}
              onChange={(event) =>
                changeRow(entry.key, "description", event.target.value)
              }
              {...feedback.field(`schedule.${entry.key}.description`)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
          </Stack>
        ))}
        <Button
          ref={addButton}
          type="button"
          startIcon={<Add />}
          disabled={disabled || values.schedule.length >= 100}
          sx={{ alignSelf: "flex-start" }}
          onClick={() => {
            const key = `agenda_${sequence.current++}`;
            setValues((current) => ({
              ...current,
              schedule: [
                ...current.schedule,
                {
                  key,
                  sourceIndex: null,
                  edited: true,
                  title: "",
                  description: "",
                  startsAt: "",
                },
              ],
            }));
            feedback.clear("schedule");
            requestAnimationFrame(() =>
              agenda.current
                ?.querySelector<HTMLInputElement>(
                  `[data-agenda-key="${key}"] input`,
                )
                ?.focus(),
            );
          }}
        >
          Add agenda entry
        </Button>
      </Stack>
      <Stack component="section" spacing={2}>
        <Typography variant="h6" component="h2">
          Public organizer
        </Typography>
        <FormControlLabel
          label="Add public organizer information"
          control={
            <Switch
              checked={organizer !== null}
              disabled={disabled}
              onChange={(_, enabled) => {
                feedback.clear("publicOrganizer");
                setValues((current) => ({
                  ...current,
                  publicOrganizer: enabled
                    ? { displayName: "", description: null, websiteUrl: null }
                    : null,
                }));
              }}
            />
          }
        />
        <Typography variant="body2" color="text.secondary">
          Only information entered here is published. Account and staff details
          are never filled in automatically.
        </Typography>
        {feedback.errors.publicOrganizer && (
          <Alert severity="error">{feedback.errors.publicOrganizer}</Alert>
        )}
        {organizer &&
          (
            [
              ["displayName", "Display name", 200],
              ["description", "Organizer description (optional)", 2000],
              ["websiteUrl", "Website URL (optional)", 2048],
            ] as const
          ).map(([name, label, maxLength]) => (
            <TextField
              key={name}
              label={label}
              required={name === "displayName"}
              value={organizer[name] ?? ""}
              multiline={name === "description"}
              fullWidth
              disabled={disabled}
              onChange={(event) => {
                feedback.clear(`publicOrganizer.${name}`);
                setValues((current) => ({
                  ...current,
                  publicOrganizer: current.publicOrganizer
                    ? {
                        ...current.publicOrganizer,
                        [name]:
                          name === "displayName"
                            ? event.target.value
                            : event.target.value || null,
                      }
                    : null,
                }));
              }}
              {...feedback.field(`publicOrganizer.${name}`)}
              slotProps={{ htmlInput: { maxLength } }}
            />
          ))}
      </Stack>
    </>
  );
}
