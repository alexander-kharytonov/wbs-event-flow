"use client";

import {
  Alert,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { EventAgendaEditor } from "@/features/events/components/event-agenda-editor";
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
  section,
  revealErrorsKey = 0,
  values,
  setValues,
  feedback,
  disabled,
}: {
  section: "location" | "agenda" | "organizer";
  revealErrorsKey?: number;
  values: EventFormValues;
  setValues: React.Dispatch<React.SetStateAction<EventFormValues>>;
  feedback: Feedback;
  disabled: boolean;
}) {
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

  return (
    <>
      {section === "location" && (
        <>
          <input
            type="hidden"
            name="location"
            value={JSON.stringify(location)}
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
                    ? {
                        venueName: location.venueName,
                        address: location.address,
                      }
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
        </>
      )}
      {section === "agenda" && (
        <>
          <input
            type="hidden"
            name="schedule"
            value={JSON.stringify(values.schedule)}
          />
          <EventAgendaEditor
            revealErrorsKey={revealErrorsKey}
            values={values}
            setValues={setValues}
            feedback={feedback}
            disabled={disabled}
          />
        </>
      )}
      {section === "organizer" && (
        <>
          <input
            type="hidden"
            name="publicOrganizer"
            value={JSON.stringify(organizer)}
          />
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
                        ? {
                            displayName: "",
                            description: null,
                            websiteUrl: null,
                          }
                        : null,
                    }));
                  }}
                />
              }
            />
            <Typography variant="body2" color="text.secondary">
              Only information entered here is published. Account and staff
              details are never filled in automatically.
            </Typography>
            {feedback.errors.publicOrganizer && (
              <Alert severity="error" tabIndex={-1} data-editor-error>
                {feedback.errors.publicOrganizer}
              </Alert>
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
      )}
    </>
  );
}
