"use client";

import { Box, Stack } from "@mui/material";
import { unstable_rethrow, useRouter } from "next/navigation";
import {
  type ReactNode,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useEditorDirty,
  useEditorNavigation,
} from "@/components/ui/editor-navigation-guard";
import { EditorNavigation } from "@/features/events/components/editor-navigation";
import {
  type EditableCover,
  EventCoverEditor,
} from "@/features/events/components/event-cover-editor";
import { EventEditorActions } from "@/features/events/components/event-editor-actions";
import { EventFormSections } from "@/features/events/components/event-form-sections";
import { richRequiredMissing } from "@/features/events/components/event-rich-fields";
import {
  type EditorSection,
  editorFingerprint,
  errorSection,
  rebaseSavedValues,
} from "@/features/events/editor-state";
import {
  type EventDateSource,
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
import { useFormFeedback } from "@/hooks/use-form-feedback";

const emptyValues: EventFormValues = {
  descriptionFormat: "MARKDOWN",
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
  startLocked: initialStartLocked = false,
  children,
  disabled = false,
  onDateEdit,
  scheduleNotice,
  importedDates,
  initialErrors,
  initialCover,
  extraDirty = false,
  onBusyChange,
}: {
  onBusyChange?: (busy: boolean) => void;
  extraDirty?: boolean;
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
  const [section, setSection] = useState<EditorSection>("basics");
  const feedback = useFormFeedback(initialErrors);
  const mutationBusy = useRef(false);
  const focusSavedSection = useRef(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const router = useRouter();
  const navigation = useEditorNavigation();
  const form = useRef<HTMLFormElement>(null);
  const [initial] = useState<EventFormValues>(() => ({
    ...initialValues,
    descriptionFormat: "MARKDOWN",
  }));
  const [values, setValues] = useState<EventFormValues>(initial);
  const [editedDates, setEditedDates] = useState<EventDateField[]>([]);
  const [dateSource, setDateSource] = useState(edit?.dates ?? importedDates);
  const [startLocked, setStartLocked] = useState(initialStartLocked);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    editorFingerprint(initial, []),
  );
  const [coverDirty, setCoverDirty] = useState(false);
  const [coverConflict, setCoverConflict] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const dirty =
    editorFingerprint(values, editedDates) !== savedFingerprint || extraDirty;
  const [state, action, pending] = useActionState(
    async (previous: EventFormState, formData: FormData) => {
      let next: EventFormState;

      try {
        next = await serverAction(previous, formData);
      } catch (error) {
        unstable_rethrow(error);
        next = {
          message:
            "Could not confirm the save. Your edits are kept. Reload the latest version before retrying if the event may have been saved.",
        };
      } finally {
        mutationBusy.current = false;
      }

      if (next.createdId) {
        navigation.confirmed(() =>
          router.replace(`/dashboard/events/${next.createdId}/edit`),
        );

        return next;
      }

      if (next.saved) {
        // Rebase every source index after reorder/delete, preserving UI row identity.
        const savedValues = rebaseSavedValues(next.saved.values, values);
        setValues(savedValues);
        setEditedDates([]);
        setDateSource(next.saved.dates);
        setStartLocked(next.saved.startLocked);
        setOpenedVersion(next.saved.version);
        setSavedFingerprint(editorFingerprint(savedValues, []));
        setValidationAttempted(false);
        focusSavedSection.current = true;
      }
      const errors = Object.fromEntries(
        Object.entries(next.errors ?? {}).map(([field, messages]) => [
          field,
          messages[0],
        ]),
      );
      feedback.setErrors(errors);
      feedback.setMessage(next.message);

      if (Object.keys(errors).length || next.message || next.conflict) {
        revealErrors(errors);
      }

      return next;
    },
    {},
  );
  useEditorDirty("event-form", dirty || coverDirty || pending || coverBusy);
  useEffect(() => {
    onBusyChange?.(pending || coverBusy || Boolean(state.createdId));
  }, [onBusyChange, pending, coverBusy, state.createdId]);

  useEffect(() => {
    if (!pending && state.saved && focusSavedSection.current) {
      focusSavedSection.current = false;
      form.current
        ?.querySelector<HTMLButtonElement>(`#editor-nav-${section}`)
        ?.focus({ preventScroll: true });
    }
  }, [pending, state.saved, section]);

  function revealErrors(errors: Record<string, string>) {
    const firstSection = Object.keys(errors).map(errorSection).find(Boolean);

    if (firstSection) {
      setSection(firstSection);
    }
    setValidationAttempted(true);
    setFocusRequest((current) => current + 1);
  }

  useEffect(() => {
    if (!focusRequest || pending) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const panel = form.current?.querySelector<HTMLElement>(
        `#editor-panel-${section}`,
      );
      const invalid = panel?.querySelector<HTMLElement>(
        '[aria-invalid="true"]:not([type="hidden"]):not([aria-hidden="true"]), [data-editor-error]',
      );
      const missing = panel
        ? Array.from(
            panel.querySelectorAll<HTMLInputElement>(
              "input[required], textarea[required]",
            ),
          ).find((input) => !input.value.trim())
        : undefined;
      const target =
        invalid ??
        missing ??
        form.current?.querySelector<HTMLElement>("[data-editor-feedback]");
      target?.focus();
      target?.scrollIntoView({ block: "center", behavior: "instant" });
      setFocusRequest(0);
    });

    return () => cancelAnimationFrame(frame);
  }, [focusRequest, pending, section]);
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
  const initialSession = useRef({
    values: initial,
    editing: Boolean(edit),
  });
  const [timezones, setTimezones] = useState<string[]>([]);

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezones(
      [
        ...new Set(["UTC", timezone, ...Intl.supportedValuesOf("timeZone")]),
      ].sort(),
    );

    if (
      !initialSession.current.editing &&
      !initialSession.current.values.timezone
    ) {
      setValues((current) => ({ ...current, timezone }));
      setSavedFingerprint(
        editorFingerprint({ ...initialSession.current.values, timezone }, []),
      );
    }
  }, []);

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

  const requiredMissing =
    richRequiredMissing(values) ||
    !values.title.trim() ||
    !values.startsAt ||
    !values.endsAt ||
    !values.timezone.trim() ||
    !values.maxGuestsPerRegistration.trim();

  function checkRequiredFields() {
    const parsed = dateSource
      ? parseEventEdit(values, dateSource, editedDates, startLocked)
      : eventInputSchema.safeParse(values);

    if (!parsed.success) {
      const errors: Record<string, string> = {};

      for (const issue of parsed.error.issues) {
        errors[eventIssuePath(issue.path, values)] ??= issue.message;
      }
      feedback.setErrors(errors);
      revealErrors(errors);
    } else if (disabled) {
      const errors = {
        review: "Complete the template questions, staff and badge settings.",
      };
      feedback.setErrors(errors);
      revealErrors(errors);
    }
  }

  const cover = (
    <>
      {edit && initialCover && openedVersion && (
        <EventCoverEditor
          eventId={edit.id}
          initial={initialCover}
          version={openedVersion}
          disabled={pending || disabled || Boolean(state.conflict)}
          onDirtyChange={setCoverDirty}
          onConflictChange={setCoverConflict}
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
    </>
  );

  return (
    <Stack
      component="form"
      ref={form}
      action={action}
      noValidate
      onSubmit={(event) => {
        if (
          pending ||
          disabled ||
          (Boolean(edit) && !dirty) ||
          state.conflict ||
          coverConflict ||
          mutationBusy.current
        ) {
          event.preventDefault();

          return;
        }

        feedback.reset();

        // Import review validates its preserved absolute instants in its local action.
        if (importedDates) {
          mutationBusy.current = true;

          return;
        }

        const parsed = edit
          ? parseEventEdit(
              values,
              dateSource ?? edit.dates,
              editedDates,
              startLocked,
            )
          : eventInputSchema.safeParse(values);

        if (!parsed.success) {
          event.preventDefault();
          const errors: Record<string, string> = {};

          for (const issue of parsed.error.issues) {
            errors[eventIssuePath(issue.path, values)] ??= issue.message;
          }
          feedback.setErrors(errors);
          revealErrors(errors);

          return;
        }
        mutationBusy.current = true;
      }}
      aria-busy={pending || coverBusy}
      sx={{
        width: "100%",
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
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
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "240px minmax(0, 1fr)",
          },
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            borderStyle: "solid",
            borderWidth: 0,
            borderRightWidth: { md: 1 },
            borderBottomWidth: { xs: 1, md: 0 },
            borderColor: "divider",
          }}
        >
          <EditorNavigation
            section={section}
            coverEnabled={Boolean(edit)}
            hasAdditionalSettings={Boolean(children)}
            onChange={setSection}
            errors={feedback.errors}
          />
        </Box>
        <Box sx={{ p: { xs: 2, sm: 4 }, minWidth: 0 }}>
          <EventFormSections
            section={section}
            revealErrorsKey={focusRequest}
            values={values}
            setValues={setValues}
            feedback={feedback}
            disabled={pending || coverBusy}
            startLocked={startLocked}
            edit={edit && dateSource ? { dates: dateSource } : undefined}
            timezones={timezones}
            markDateEdited={markDateEdited}
            dateLimit={dateLimit}
            field={field}
            cover={cover}
            scheduleNotice={scheduleNotice}
          >
            {children}
          </EventFormSections>
        </Box>
      </Box>
      <EventEditorActions
        eventId={edit?.id}
        createdId={state.createdId}
        message={feedback.message}
        serverMessage={state.message}
        unmappedError={unmappedError}
        errors={feedback.errors}
        conflict={Boolean(state.conflict)}
        coverConflict={coverConflict}
        saved={Boolean(state.saved)}
        pending={pending}
        coverBusy={coverBusy}
        dirty={dirty}
        coverDirty={coverDirty}
        validationAttempted={validationAttempted}
        requiredMissing={requiredMissing}
        disabled={disabled}
        onShowErrors={() => revealErrors(feedback.errors)}
        onCheckRequired={checkRequiredFields}
      />
    </Stack>
  );
}
