"use client";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  type ReactNode,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type EditableCover,
  EventCoverEditor,
} from "@/features/events/components/event-cover-editor";
import { EventDescription } from "@/features/events/components/event-description";
import {
  EventRichFields,
  richRequiredMissing,
} from "@/features/events/components/event-rich-fields";
import {
  type EventDateSource,
  eventLocalDate,
  parseEventEdit,
} from "@/features/events/event-form-values";
import {
  type EventDateField,
  type EventFormState,
  type EventFormValues,
  eventDateFields,
  eventInputSchema,
  eventIssuePath,
} from "@/features/events/event-input-schema";
import { formatTimezone } from "@/features/events/format-timezone";
import { useFormFeedback } from "@/hooks/use-form-feedback";

const emptyValues: EventFormValues = {
  descriptionFormat: "PLAIN_TEXT",
  location: null,
  schedule: [],
  publicOrganizer: null,
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  timezone: "",
  visibility: "PRIVATE",
  accountRequirement: "OPTIONAL",
  capacity: "",
  maxGuestsPerRegistration: "0",
  registrationOpensAt: "",
  registrationClosesAt: "",
};

export function EventForm({
  initialValues = emptyValues,
  serverAction,
  edit,
  startLocked = false,
  children,
  disabled = false,
  onDateEdit,
  scheduleNotice,
  importedDates,
  initialErrors,
  initialCover,
}: {
  initialCover?: EditableCover;
  initialErrors?: Record<string, string>;
  startLocked?: boolean;
  importedDates?: EventDateSource;
  children?: ReactNode;
  scheduleNotice?: (values: EventFormValues) => ReactNode;
  disabled?: boolean;
  onDateEdit?: (field: keyof EventFormValues) => void;
  initialValues?: EventFormValues;
  serverAction: (
    previous: EventFormState,
    formData: FormData,
  ) => Promise<EventFormState>;
  edit?: { id: string; version: string; dates: EventDateSource };
}) {
  const feedback = useFormFeedback(initialErrors);
  const mutationBusy = useRef(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState(false);
  const [state, action, pending] = useActionState(
    async (previous: EventFormState, formData: FormData) => {
      let next: EventFormState;

      try {
        next = await serverAction(previous, formData);
      } finally {
        mutationBusy.current = false;
      }
      feedback.setErrors(
        Object.fromEntries(
          Object.entries(next.errors ?? {}).map(([field, messages]) => [
            field,
            messages[0],
          ]),
        ),
      );
      feedback.setMessage(next.message);

      return next;
    },
    {},
  );
  const [values, setValues] = useState(initialValues);
  const [editedDates, setEditedDates] = useState<EventDateField[]>([]);
  const dateSource = edit?.dates ?? importedDates;
  const validExactSchedule = dateSource
    ? parseEventEdit(
        { ...values, location: null, publicOrganizer: null, schedule: [] },
        dateSource,
        editedDates,
        startLocked,
      ).success
    : false;

  // Wall-clock hints must not exclude preserved absolute intervals at a DST fold.
  function dateLimit(
    field: EventDateField,
    direction: "min" | "max",
    boundaries: EventDateField[],
  ) {
    const candidates = boundaries
      .map((boundary) => values[boundary])
      .filter(Boolean)
      .sort();
    const limit = direction === "min" ? candidates.at(-1) : candidates[0];

    if (!limit) {
      return undefined;
    }

    if (
      validExactSchedule &&
      values[field] &&
      (direction === "min" ? values[field] < limit : values[field] > limit)
    ) {
      return undefined;
    }

    return limit;
  }
  const [openedVersion, setOpenedVersion] = useState(edit?.version);
  const [timezones, setTimezones] = useState<string[]>([]);

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezones(
      [
        ...new Set(["UTC", timezone, ...Intl.supportedValuesOf("timeZone")]),
      ].sort(),
    );

    if (!edit && !initialValues.timezone) {
      setValues((current) => ({ ...current, timezone }));
    }
  }, [edit, initialValues.timezone]);

  function markDateEdited(name: keyof EventFormValues) {
    onDateEdit?.(name);

    if (!dateSource) {
      return;
    }

    const fields =
      name === "timezone"
        ? eventDateFields.filter(
            (field) => !(startLocked && field === "startsAt"),
          )
        : eventDateFields.filter((field) => field === name);
    setEditedDates((current) => [...new Set([...current, ...fields])]);
  }

  function field(
    name: Exclude<
      keyof typeof values,
      "location" | "schedule" | "publicOrganizer"
    >,
  ) {
    return {
      name,
      value: values[name],
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => {
        feedback.clear(name);
        markDateEdited(name);
        setValues((current) => ({ ...current, [name]: event.target.value }));
      },
      ...feedback.field(name),
      disabled: pending || coverBusy,
      fullWidth: true,
    };
  }

  const unmappedError = Object.entries(feedback.errors).find(([name]) => {
    if (Object.hasOwn(values, name)) {
      return false;
    }

    return !/^(location\.(venueName|address|onlineLabel|onlineUrl)|publicOrganizer\.(displayName|description|websiteUrl)|schedule\.agenda_[0-9]+\.(title|description|startsAt))$/.test(
      name,
    );
  })?.[1];

  return (
    <Stack
      component="form"
      action={action}
      noValidate
      onSubmit={(event) => {
        feedback.reset();

        if (pending || disabled || mutationBusy.current) {
          event.preventDefault();

          return;
        }

        // Import review validates its preserved absolute instants in its local action.
        if (importedDates) {
          mutationBusy.current = true;

          return;
        }

        const parsed = edit
          ? parseEventEdit(values, edit.dates, editedDates, startLocked)
          : eventInputSchema.safeParse(values);

        if (!parsed.success) {
          event.preventDefault();
          const errors: Record<string, string> = {};

          for (const issue of parsed.error.issues) {
            errors[eventIssuePath(issue.path, values)] ??= issue.message;
          }
          feedback.setErrors(errors);

          return;
        }
        mutationBusy.current = true;
      }}
      spacing={3}
      useFlexGap
      aria-busy={pending || coverBusy}
      sx={{
        width: "100%",
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        p: { xs: 2, sm: 4 },
      }}
    >
      {edit && (
        <>
          <input type="hidden" name="eventId" value={edit.id} />
          <input type="hidden" name="version" value={openedVersion} />
          {editedDates.map((field) => (
            <input key={field} type="hidden" name="editedDate" value={field} />
          ))}
        </>
      )}
      {edit && initialCover && openedVersion && (
        <EventCoverEditor
          eventId={edit.id}
          initial={initialCover}
          version={openedVersion}
          disabled={pending || disabled}
          begin={() => {
            if (mutationBusy.current) {
              return false;
            }
            mutationBusy.current = true;
            setCoverBusy(true);

            return true;
          }}
          end={() => {
            mutationBusy.current = false;
            setCoverBusy(false);
          }}
          onSaved={setOpenedVersion}
        />
      )}
      <Box
        component="section"
        sx={{ pb: 3, borderBottom: 1, borderColor: "divider" }}
      >
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
          <TextField
            {...field("descriptionFormat")}
            label="Description format"
            select
          >
            <MenuItem value="PLAIN_TEXT">Plain text</MenuItem>
            <MenuItem value="MARKDOWN">Markdown</MenuItem>
          </TextField>
          <TextField
            {...field("description")}
            label="Description"
            multiline
            minRows={3}
            slotProps={{ htmlInput: { maxLength: 20000 } }}
          />
          {values.descriptionFormat === "MARKDOWN" && (
            <>
              <Typography variant="body2" color="text.secondary">
                Headings, paragraphs, emphasis, lists and HTTP(S) links are
                supported. HTML and embedded images are not rendered.
              </Typography>
              <Button
                type="button"
                aria-expanded={markdownPreview}
                aria-controls="event-markdown-preview"
                onClick={() => setMarkdownPreview((current) => !current)}
                sx={{ alignSelf: "flex-start" }}
              >
                {markdownPreview
                  ? "Hide Markdown preview"
                  : "Show Markdown preview"}
              </Button>
              {markdownPreview && (
                <Box
                  id="event-markdown-preview"
                  role="region"
                  aria-label="Markdown preview"
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  <EventDescription
                    text={values.description}
                    format="MARKDOWN"
                  />
                </Box>
              )}
            </>
          )}
        </Stack>
      </Box>
      <Box
        component="section"
        sx={{ pb: 3, borderBottom: 1, borderColor: "divider" }}
      >
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
            disabled={pending || coverBusy}
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
          <Typography variant="body2" color="text.secondary">
            Times skipped or repeated during daylight saving changes must be
            replaced with an unambiguous time.
          </Typography>
          {scheduleNotice?.(values)}
        </Stack>
      </Box>
      <Box
        component="section"
        sx={{ pb: 3, borderBottom: 1, borderColor: "divider" }}
      >
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
                  disabled={pending || coverBusy}
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
              <input type="hidden" name="maxGuestsPerRegistration" value="0" />
            )}
            <Typography variant="body2" color="text.secondary">
              Guests count toward event capacity and can be managed until the
              event starts.
            </Typography>
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
      <Box
        component="section"
        sx={{ pb: 3, borderBottom: 1, borderColor: "divider" }}
      >
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
      <EventRichFields
        values={values}
        setValues={setValues}
        feedback={feedback}
        disabled={pending || coverBusy || disabled}
      />
      {children}
      {(feedback.message || unmappedError || state.conflict) && (
        <Alert severity="error" role="alert">
          {state.conflict ? state.message : (feedback.message ?? unmappedError)}
          {state.conflict && edit && (
            <Box sx={{ mt: 1 }}>
              <Button
                color="inherit"
                size="small"
                component="a"
                href={`/dashboard/events/${edit.id}/edit`}
              >
                Reload latest version
              </Button>
            </Box>
          )}
        </Alert>
      )}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {edit
            ? "Changes are saved to your workspace. Publish them when you’re ready to update the public event."
            : "Your event starts as an unpublished draft. You can review it before publishing."}
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ "& > a": { alignSelf: { xs: "flex-start", sm: "center" } } }}
        >
          <Button
            type="submit"
            variant="contained"
            disabled={
              pending ||
              coverBusy ||
              richRequiredMissing(values) ||
              disabled ||
              !values.title.trim() ||
              !values.startsAt ||
              !values.endsAt ||
              !values.timezone.trim() ||
              !values.maxGuestsPerRegistration.trim()
            }
          >
            {pending
              ? edit
                ? "Saving…"
                : "Creating…"
              : edit
                ? "Save changes"
                : "Create event"}
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}
