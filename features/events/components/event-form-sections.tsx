"use client";

import {
  Alert,
  Autocomplete,
  Box,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { EventDescriptionEditor } from "@/features/events/components/event-description-editor";
import { EventRichFields } from "@/features/events/components/event-rich-fields";
import type { EditorSection } from "@/features/events/editor-state";
import {
  type EventDateSource,
  eventLocalDate,
} from "@/features/events/event-form-values";
import type {
  EventDateField,
  EventFormValues,
} from "@/features/events/event-input-schema";
import { formatTimezone } from "@/features/events/format-timezone";
import type { useFormFeedback } from "@/hooks/use-form-feedback";

type Props = {
  section: EditorSection;
  revealErrorsKey: number;
  values: EventFormValues;
  setValues: Dispatch<SetStateAction<EventFormValues>>;
  feedback: ReturnType<typeof useFormFeedback>;
  disabled: boolean;
  startLocked: boolean;
  edit?: { dates: EventDateSource };
  timezones: string[];
  markDateEdited: (name: keyof EventFormValues) => void;
  dateLimit: (
    field: EventDateField,
    direction: "min" | "max",
    boundaries: EventDateField[],
  ) => string | undefined;
  field: (
    name: Exclude<
      keyof EventFormValues,
      "location" | "schedule" | "publicOrganizer"
    >,
  ) => {
    name: string;
    value: string;
    disabled: boolean;
    fullWidth: boolean;
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => void;
    error: boolean;
    helperText: string;
  };
  cover: ReactNode;
  children?: ReactNode;
  scheduleNotice?: (values: EventFormValues) => ReactNode;
};

export function EventFormSections({
  section,
  revealErrorsKey,
  values,
  setValues,
  feedback,
  disabled,
  startLocked,
  edit,
  timezones,
  markDateEdited,
  dateLimit,
  field,
  cover,
  children,
  scheduleNotice,
}: Props) {
  return (
    <>
      <Stack
        id="editor-panel-basics"
        role="tabpanel"
        aria-labelledby="editor-nav-basics"
        hidden={section !== "basics"}
        sx={{ display: section === "basics" ? "flex" : "none", minWidth: 0 }}
        spacing={3}
      >
        <Box component="section">
          <Stack spacing={3}>
            <Typography variant="h6" component="h2">
              Basic information
            </Typography>
            <TextField
              {...field("title")}
              label="Event name"
              required
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <EventDescriptionEditor
              value={values.description}
              disabled={disabled}
              error={feedback.errors.description}
              formatError={feedback.errors.descriptionFormat}
              onChange={(description) => {
                feedback.clear("description");
                feedback.clear("descriptionFormat");
                setValues((current) => ({ ...current, description }));
              }}
            />
          </Stack>
        </Box>
      </Stack>
      <Stack
        id="editor-panel-cover"
        role="tabpanel"
        aria-labelledby="editor-nav-cover"
        hidden={section !== "cover"}
        sx={{ display: section === "cover" ? "flex" : "none", minWidth: 0 }}
      >
        {cover}
      </Stack>
      <Stack
        id="editor-panel-schedule"
        role="tabpanel"
        aria-labelledby="editor-nav-schedule"
        hidden={section !== "schedule"}
        sx={{ display: section === "schedule" ? "flex" : "none", minWidth: 0 }}
        spacing={3}
      >
        <Box component="section">
          <Stack spacing={3}>
            <Typography variant="h6" component="h2">
              Schedule
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  sm: "repeat(2, minmax(0, 1fr))",
                },
                gap: 3,
              }}
            >
              <TextField
                {...field("startsAt")}
                label="Start"
                type="datetime-local"
                required
                slotProps={{
                  inputLabel: { shrink: true },
                  input: { readOnly: startLocked },
                  htmlInput: {
                    min: dateLimit("startsAt", "min", ["registrationOpensAt"]),
                    max: dateLimit("startsAt", "max", ["endsAt"]),
                  },
                }}
              />
              <TextField
                {...field("endsAt")}
                label="End"
                type="datetime-local"
                required
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: {
                    min: dateLimit("endsAt", "min", [
                      "startsAt",
                      "registrationClosesAt",
                    ]),
                  },
                }}
              />
            </Box>
            <input type="hidden" name="timezone" value={values.timezone} />
            <Autocomplete
              disabled={disabled}
              freeSolo
              options={timezones}
              getOptionLabel={formatTimezone}
              filterOptions={(options, { inputValue }) => {
                const query = formatTimezone(inputValue).toLowerCase();

                return options.filter((timezone) =>
                  formatTimezone(timezone).toLowerCase().includes(query),
                );
              }}
              inputValue={formatTimezone(values.timezone)}
              onInputChange={(_, input) => {
                if (input.replaceAll(" ", "_") === values.timezone) {
                  return;
                }

                feedback.clear("timezone");
                markDateEdited("timezone");
                const timezone = input.replaceAll(" ", "_");
                setValues((current) => {
                  let startsAt = current.startsAt;

                  if (startLocked && edit) {
                    try {
                      // Use the exact instant, including an unambiguous DST fold offset.
                      startsAt = eventLocalDate(edit.dates.startsAt, timezone);
                    } catch {
                      // Incomplete timezone input is validated on submit.
                    }
                  }

                  return {
                    ...current,
                    startsAt,
                    timezone,
                    schedule: current.schedule.map((entry) => ({
                      ...entry,
                      edited: true,
                    })),
                  };
                });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Timezone"
                  required
                  error={Boolean(feedback.errors.timezone)}
                  helperText={
                    feedback.errors.timezone ??
                    "All dates and times use this IANA timezone."
                  }
                />
              )}
            />
            <Alert severity="info">
              Times skipped or repeated during daylight saving changes must be
              replaced with an unambiguous time.
            </Alert>
            {scheduleNotice?.(values)}
          </Stack>
        </Box>
      </Stack>
      {(["location", "agenda"] as const).map((panel) => (
        <Stack
          key={panel}
          id={`editor-panel-${panel}`}
          role="tabpanel"
          aria-labelledby={`editor-nav-${panel}`}
          hidden={section !== panel}
          sx={{ display: section === panel ? "flex" : "none", minWidth: 0 }}
          spacing={3}
        >
          <EventRichFields
            section={panel}
            revealErrorsKey={revealErrorsKey}
            values={values}
            setValues={setValues}
            feedback={feedback}
            disabled={disabled}
          />
        </Stack>
      ))}
      <Stack
        id="editor-panel-registration"
        role="tabpanel"
        aria-labelledby="editor-nav-registration"
        hidden={section !== "registration"}
        sx={{
          display: section === "registration" ? "flex" : "none",
          minWidth: 0,
        }}
        spacing={3}
      >
        <Box component="section">
          <Stack spacing={3}>
            <Typography variant="h6" component="h2">
              Registration
            </Typography>
            <Stack spacing={1}>
              <FormControlLabel
                label="Allow attendees to bring guests"
                control={
                  <Switch
                    checked={values.maxGuestsPerRegistration !== "0"}
                    disabled={disabled}
                    onChange={(_, enabled) => {
                      feedback.clear("maxGuestsPerRegistration");
                      setValues((current) => ({
                        ...current,
                        maxGuestsPerRegistration: enabled ? "1" : "0",
                      }));
                    }}
                  />
                }
              />
              {values.maxGuestsPerRegistration !== "0" ? (
                <TextField
                  {...field("maxGuestsPerRegistration")}
                  label="Maximum guests per registration"
                  type="number"
                  slotProps={{ htmlInput: { min: 1, max: 10 } }}
                />
              ) : (
                <input
                  type="hidden"
                  name="maxGuestsPerRegistration"
                  value="0"
                />
              )}
              <Alert severity="info">
                Guests count toward event capacity and can be managed until the
                event starts.
              </Alert>
            </Stack>
            <TextField
              {...field("capacity")}
              label="Event capacity"
              type="number"
              slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
              helperText={
                feedback.errors.capacity ??
                "Leave blank for no limit on admitted attendees."
              }
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  sm: "repeat(2, minmax(0, 1fr))",
                },
                gap: 3,
              }}
            >
              <TextField
                {...field("registrationOpensAt")}
                label="Registration opens"
                type="datetime-local"
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: {
                    max: dateLimit("registrationOpensAt", "max", [
                      "startsAt",
                      "registrationClosesAt",
                    ]),
                  },
                }}
                helperText={
                  feedback.errors.registrationOpensAt ??
                  "Leave blank to allow registration immediately. Must be no later than the event start and before registration closes."
                }
              />
              <TextField
                {...field("registrationClosesAt")}
                label="Registration closes"
                type="datetime-local"
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: {
                    min: dateLimit("registrationClosesAt", "min", [
                      "registrationOpensAt",
                    ]),
                    max: dateLimit("registrationClosesAt", "max", ["endsAt"]),
                  },
                }}
                helperText={
                  feedback.errors.registrationClosesAt ??
                  "Leave blank to close registration when the event ends. Must be after registration opens and no later than the event end."
                }
              />
            </Box>
          </Stack>
        </Box>
        <Box component="section">
          <Stack spacing={3}>
            <Typography variant="h6" component="h2">
              Access
            </Typography>
            <TextField
              {...field("visibility")}
              label="Who can discover this event?"
              select
              helperText={
                feedback.errors.visibility ??
                (values.visibility === "PRIVATE"
                  ? "Only people with the event link can find it. The link is not password protected."
                  : "Your published event appears in Explore events.")
              }
            >
              <MenuItem value="PRIVATE">Private</MenuItem>
              <MenuItem value="PUBLIC">Public</MenuItem>
            </TextField>
            <TextField
              {...field("accountRequirement")}
              label="Do applicants need an account?"
              helperText={
                feedback.errors.accountRequirement ??
                "A required account must have a verified email before applying."
              }
              select
            >
              <MenuItem value="OPTIONAL">No — account optional</MenuItem>
              <MenuItem value="REQUIRED">
                Yes — verified account required
              </MenuItem>
            </TextField>
          </Stack>
        </Box>
      </Stack>
      <Stack
        id="editor-panel-organizer"
        role="tabpanel"
        aria-labelledby="editor-nav-organizer"
        hidden={section !== "organizer"}
        sx={{ display: section === "organizer" ? "flex" : "none", minWidth: 0 }}
        spacing={3}
      >
        <EventRichFields
          section="organizer"
          values={values}
          setValues={setValues}
          feedback={feedback}
          disabled={disabled}
        />
      </Stack>
      {children && (
        <Stack
          id="editor-panel-additional"
          role="tabpanel"
          aria-labelledby="editor-nav-additional"
          hidden={section !== "additional"}
          sx={{
            display: section === "additional" ? "flex" : "none",
            minWidth: 0,
          }}
          spacing={3}
        >
          {feedback.errors.review && (
            <Alert severity="error" tabIndex={-1} data-editor-error>
              {feedback.errors.review}
            </Alert>
          )}
          {children}
        </Stack>
      )}
    </>
  );
}
