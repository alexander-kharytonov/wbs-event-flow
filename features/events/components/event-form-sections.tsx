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
} from "@mui/material";
import { useTranslations } from "next-intl";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { SectionHeader } from "@/components/ui/section-header";
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
import {
  eventLanguageNames,
  eventLanguages,
} from "@/features/events/event-language";
import { formatTimezone } from "@/features/events/format-timezone";
import type { useFormFeedback } from "@/hooks/use-form-feedback";

type Props = {
  passwordFields?: ReactNode;
  section: EditorSection;
  revealErrorsKey: number;
  values: EventFormValues;
  setValues: Dispatch<SetStateAction<EventFormValues>>;
  feedback: ReturnType<typeof useFormFeedback<string>>;
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
  passwordFields,
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
  const t = useTranslations("events");
  const validation = useTranslations("validation");

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
            <SectionHeader
              title={t("basicInformation")}
              description={t("editorBasicsDescription")}
            />
            <TextField
              {...field("title")}
              label={t("eventName")}
              required
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <TextField
              {...field("language")}
              select
              required
              label={t("eventLanguage")}
              helperText={
                feedback.errors.language
                  ? validation("invalidEventLanguage")
                  : t("contentLanguageHint")
              }
            >
              {eventLanguages.map((language) => (
                <MenuItem key={language} value={language}>
                  {language.toUpperCase()} — {eventLanguageNames[language]}
                </MenuItem>
              ))}
            </TextField>
            <EventDescriptionEditor
              value={values.description}
              disabled={disabled}
              error={feedback.errors.description}
              onChange={(description) => {
                feedback.clear("description");
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
          <Stack spacing={3} useFlexGap>
            <SectionHeader
              title={t("schedule")}
              description={t("editorScheduleDescription")}
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
                {...field("startsAt")}
                label={t("start")}
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
                label={t("end")}
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
                  label={t("timezone")}
                  required
                  error={Boolean(feedback.errors.timezone)}
                  helperText={feedback.errors.timezone ?? t("timezoneHint")}
                />
              )}
            />
            <Alert severity="info">{t("dstHint")}</Alert>
            {scheduleNotice?.(values)}
          </Stack>
        </Box>
      </Stack>
      {(["location", "agenda"] as const).map((panel) => (
        <Stack
          key={panel}
          id={`editor-panel-${panel}`}
          useFlexGap
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
            <SectionHeader
              title={t("registration")}
              description={t("editorRegistrationDescription")}
            />
            <TextField
              {...field("capacity")}
              label={t("eventCapacity")}
              type="number"
              slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
              helperText={feedback.errors.capacity ?? t("capacityHint")}
            />
            <Stack spacing={2} useFlexGap>
              <FormControlLabel
                label={t("allowGuests")}
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
                  label={t("maxGuests")}
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
            </Stack>
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
                label={t("registrationOpens")}
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
                  t("registrationOpenHint")
                }
              />
              <TextField
                {...field("registrationClosesAt")}
                label={t("registrationCloses")}
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
                  t("registrationCloseHint")
                }
              />
            </Box>
          </Stack>
        </Box>
      </Stack>
      <Stack
        id="editor-panel-access"
        role="tabpanel"
        aria-labelledby="editor-nav-access"
        hidden={section !== "access"}
        sx={{ display: section === "access" ? "flex" : "none", minWidth: 0 }}
        spacing={3}
      >
        <Box component="section">
          <Stack spacing={3}>
            <SectionHeader
              title={t("access")}
              description={t("editorAccessDescription")}
            />
            <TextField
              {...field("visibility")}
              label={t("discoverability")}
              select
              helperText={
                feedback.errors.visibility ??
                (values.visibility === "PRIVATE"
                  ? t("privateHint")
                  : t("publicHint"))
              }
            >
              <MenuItem value="PRIVATE">{t("private")}</MenuItem>
              <MenuItem value="PUBLIC">{t("public")}</MenuItem>
            </TextField>
            {passwordFields}
            <TextField
              {...field("accountRequirement")}
              label={t("accountRequirement")}
              helperText={
                feedback.errors.accountRequirement ??
                t("accountRequirementHint")
              }
              select
            >
              <MenuItem value="OPTIONAL">{t("accountOptional")}</MenuItem>
              <MenuItem value="REQUIRED">{t("accountRequired")}</MenuItem>
            </TextField>
          </Stack>
        </Box>
      </Stack>
      <Stack
        id="editor-panel-organizer"
        useFlexGap
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
