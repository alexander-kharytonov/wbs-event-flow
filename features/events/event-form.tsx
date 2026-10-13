"use client";

import { Alert, Box, Button, Stack } from "@mui/material";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import { EventAccessPublication } from "@/features/events/components/event-access-publication";
import {
  type EditableCover,
  EventCoverEditor,
} from "@/features/events/components/event-cover-editor";
import { EventEditorActions } from "@/features/events/components/event-editor-actions";
import { EventFormSections } from "@/features/events/components/event-form-sections";
import { EventPasswordFields } from "@/features/events/components/event-password-fields";
import { richRequiredMissing } from "@/features/events/components/event-rich-fields";
import {
  type EditorSection,
  editorFingerprint,
  errorSection,
  rebaseSavedValues,
} from "@/features/events/editor-state";
import {
  type EventDateSource,
  eventDateLimits,
  parseEventEdit,
} from "@/features/events/event-form-values";
import {
  type EventDateField,
  type EventFormState,
  type EventFormValues,
  eventDateFields,
  eventInputIssueMessage,
  eventInputSchema,
  eventIssuePath,
} from "@/features/events/event-input-schema";
import { eventLanguageSchema } from "@/features/events/event-language";
import { eventPasswordSchema } from "@/features/events/event-password-input";
import { useEventCreationRetry } from "@/features/events/use-event-creation-retry";
import { useEventPasswordDraft } from "@/features/events/use-event-password-draft";
import { useFormFeedback } from "@/hooks/use-form-feedback";

const emptyValues: Omit<EventFormValues, "language"> = {
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
  initialPasswordProtected = false,
  initialAccessPublication,
  initialValues,
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
  initialPasswordProtected?: boolean;
  initialAccessPublication?: { contentVersion: number; pending: boolean };
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
  const password = useEventPasswordDraft(initialPasswordProtected);
  const {
    passwordInput,
    passwordEnabled,
    passwordSaved,
    passwordFilled,
    passwordDirty,
  } = password;
  const [accessPublication, setAccessPublication] = useState(
    initialAccessPublication,
  );
  const locale = useLocale();
  const t = useTranslations("events");
  const validation = useTranslations("validation");
  const translateError = (code: string) =>
    code === "invalidEventLanguage"
      ? validation("invalidEventLanguage")
      : t(code as keyof import("@/lib/i18n/messages").Messages["events"]);
  const [section, setSection] = useState<EditorSection>("basics");
  const feedback = useFormFeedback(initialErrors, translateError);
  const mutationBusy = useRef(false);
  const focusSavedSection = useRef(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const router = useRouter();
  const navigation = useEditorNavigation();
  const form = useRef<HTMLFormElement>(null);
  const [initial] = useState<EventFormValues>(() => ({
    ...(initialValues ?? {
      ...emptyValues,
      language: eventLanguageSchema.parse(locale),
    }),
  }));
  const [values, setValues] = useState<EventFormValues>(initial);
  const [editedDates, setEditedDates] = useState<EventDateField[]>([]);
  const [dateSource, setDateSource] = useState(edit?.dates ?? importedDates);
  const [startLocked, setStartLocked] = useState(initialStartLocked);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    editorFingerprint(initial, []),
  );
  const [coverDirty, setCoverDirty] = useState(false);
  const [coverUnprepared, setCoverUnprepared] = useState(false);
  const creation = useEventCreationRetry();
  const { creationUncertain, submittedCoverId } = creation;
  const [preparedCoverId, setPreparedCoverId] = useState<string | null>(null);
  const [coverConflict, setCoverConflict] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const dirty =
    editorFingerprint(values, editedDates) !== savedFingerprint ||
    extraDirty ||
    passwordDirty ||
    passwordEnabled !== passwordSaved;
  const [state, action, pending] = useActionState(
    async (previous: EventFormState, formData: FormData) => {
      let next: EventFormState;

      const submission = edit ? formData : creation.prepare(formData);

      try {
        next = await serverAction(previous, submission);
      } catch (error) {
        unstable_rethrow(error);
        next = {
          message: "inputSaveUnconfirmed",
          creationUncertain: !edit,
        };
      } finally {
        mutationBusy.current = false;

        password.clearDraft();
      }

      if (!edit) {
        creation.settle(next);
      }

      if (next.createdId) {
        navigation.confirmed(() =>
          router.replace(`/dashboard/events/${next.createdId}/edit`),
        );

        return next;
      }

      if (next.saved) {
        password.adoptSaved(next.saved.passwordProtected);
        setAccessPublication(next.saved.accessPublication);
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

      if (next.message === "creationCoverUnavailable") {
        setSection("cover");
      }

      if (Object.keys(errors).length || next.message || next.conflict) {
        revealErrors(errors);
      }

      return next;
    },
    {},
  );
  useEditorDirty(
    "event-form",
    dirty || coverDirty || pending || coverBusy || creationUncertain,
  );
  useEffect(() => {
    onBusyChange?.(
      pending || coverBusy || Boolean(state.createdId) || creationUncertain,
    );
  }, [onBusyChange, pending, coverBusy, state.createdId, creationUncertain]);

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
  const dateLimit = eventDateLimits(
    values,
    dateSource,
    editedDates,
    startLocked,
  );
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

        if (name === "visibility") {
          password.clearDraft();
        }
        markDateEdited(name);
        setValues((current) => ({ ...current, [name]: event.target.value }));
      },
      ...feedback.field(name),
      disabled: pending || coverBusy,
      fullWidth: true,
    };
  }

  const unmappedError = Object.entries(feedback.errors).find(([name]) => {
    if (Object.hasOwn(values, name) || name === "eventPassword") {
      return false;
    }

    return !/^(location\.(venueName|address|onlineLabel|onlineUrl)|publicOrganizer\.(displayName|description|websiteUrl)|schedule\.agenda_[0-9]+\.(title|description|startsAt))$/.test(
      name,
    );
  })?.[1];

  const requiredMissing =
    richRequiredMissing(values) ||
    !values.title.trim() ||
    !values.language ||
    !values.startsAt ||
    !values.endsAt ||
    !values.timezone.trim() ||
    !values.maxGuestsPerRegistration.trim() ||
    (values.visibility === "PRIVATE" &&
      passwordEnabled &&
      !passwordSaved &&
      !passwordFilled);

  function checkRequiredFields() {
    if (
      values.visibility === "PRIVATE" &&
      passwordEnabled &&
      !passwordSaved &&
      !passwordFilled
    ) {
      feedback.setErrors({
        ...feedback.errors,
        eventPassword: "accessPasswordInvalid",
      });
      revealErrors({ eventPassword: "accessPasswordInvalid" });

      return;
    }
    const parsed = dateSource
      ? parseEventEdit(values, dateSource, editedDates, startLocked)
      : eventInputSchema.safeParse(values);

    if (!parsed.success) {
      const errors: Record<string, string> = {};

      for (const issue of parsed.error.issues) {
        errors[eventIssuePath(issue.path, values)] ??=
          eventInputIssueMessage(issue);
      }
      feedback.setErrors(errors);
      revealErrors(errors);
    } else if (disabled) {
      const errors = {
        review: "inputCompleteReview",
      };
      feedback.setErrors(errors);
      revealErrors(errors);
    }
  }

  const staleCoverError =
    state.message === "creationCoverUnavailable" &&
    preparedCoverId !== submittedCoverId;
  const cover = (
    <>
      {(!edit || (initialCover && openedVersion)) && (
        <EventCoverEditor
          eventId={edit?.id}
          initial={initialCover ?? { assetId: null, alt: null }}
          version={openedVersion ?? ""}
          disabled={
            pending || disabled || creationUncertain || Boolean(state.conflict)
          }
          onUnpreparedChange={setCoverUnprepared}
          onPreparedChange={setPreparedCoverId}
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
        if (creationUncertain && !pending && !mutationBusy.current) {
          mutationBusy.current = true;

          return;
        }

        if (
          pending ||
          disabled ||
          (Boolean(edit) && !dirty) ||
          state.conflict ||
          coverConflict ||
          (!edit && coverUnprepared) ||
          mutationBusy.current
        ) {
          event.preventDefault();

          return;
        }

        feedback.reset();

        if (
          !importedDates &&
          values.visibility === "PRIVATE" &&
          passwordEnabled &&
          (!passwordSaved || passwordFilled) &&
          !eventPasswordSchema.safeParse(passwordInput.current?.value).success
        ) {
          event.preventDefault();
          feedback.setErrors({ eventPassword: "accessPasswordInvalid" });
          revealErrors({ eventPassword: "accessPasswordInvalid" });

          return;
        }

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
            errors[eventIssuePath(issue.path, values)] ??=
              eventInputIssueMessage(issue);
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
      <Box
        component="fieldset"
        disabled={creationUncertain || Boolean(state.createdId)}
        sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
      >
        {!importedDates && (
          <input
            type="hidden"
            name="passwordProtection"
            value={
              values.visibility === "PRIVATE" && passwordEnabled
                ? "true"
                : "false"
            }
          />
        )}
        {!passwordEnabled && (
          <input type="hidden" name="eventPassword" value="" />
        )}
        {edit && (
          <>
            <input type="hidden" name="eventId" value={edit.id} />
            <input type="hidden" name="version" value={openedVersion} />
            {editedDates.map((field) => (
              <input
                key={field}
                type="hidden"
                name="editedDate"
                value={field}
              />
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
              coverEnabled
              hasAdditionalSettings={Boolean(children)}
              onChange={setSection}
              errors={feedback.errors}
            />
          </Box>
          <Box sx={{ p: { xs: 2, sm: 4 }, minWidth: 0 }}>
            <EventFormSections
              passwordFields={
                <Stack spacing={2}>
                  {accessPublication?.pending && edit && (
                    <EventAccessPublication
                      key={accessPublication.contentVersion}
                      eventId={edit.id}
                      contentVersion={accessPublication.contentVersion}
                      disabled={
                        dirty ||
                        coverDirty ||
                        pending ||
                        coverBusy ||
                        Boolean(state.conflict)
                      }
                    />
                  )}
                  {values.visibility === "PRIVATE" &&
                    (importedDates ? (
                      <Alert severity="info">{t("accessTemplateHint")}</Alert>
                    ) : (
                      <EventPasswordFields
                        enabled={passwordEnabled}
                        saved={passwordSaved}
                        filled={passwordFilled}
                        input={passwordInput}
                        disabled={pending || coverBusy}
                        error={
                          feedback.errors.eventPassword
                            ? translateError(feedback.errors.eventPassword)
                            : undefined
                        }
                        onToggle={(enabled) => {
                          password.toggle(enabled);
                          feedback.clear("eventPassword");
                        }}
                        onInput={() => {
                          password.inputChanged();
                          feedback.clear("eventPassword");
                        }}
                      />
                    ))}
                </Stack>
              }
              section={section}
              revealErrorsKey={focusRequest}
              values={values}
              setValues={setValues}
              feedback={{
                ...feedback,
                errors: Object.fromEntries(
                  Object.entries(feedback.errors).map(([field, code]) => [
                    field,
                    translateError(code),
                  ]),
                ),
              }}
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
      </Box>
      {creationUncertain && (
        <Alert
          severity="warning"
          sx={{ m: 2 }}
          tabIndex={-1}
          data-editor-feedback
        >
          <Stack spacing={2}>
            <span>{t("creationUncertain")}</span>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              <Button
                type="submit"
                variant="outlined"
                disabled={pending}
                color="inherit"
              >
                {pending ? t("creating") : t("creationRetry")}
              </Button>
              <Button
                href="/dashboard/events"
                disabled={pending}
                color="inherit"
              >
                {t("cancel")}
              </Button>
            </Stack>
          </Stack>
        </Alert>
      )}
      {!creationUncertain && (
        <EventEditorActions
          eventId={edit?.id}
          createdId={state.createdId}
          message={staleCoverError ? undefined : feedback.message}
          serverMessage={
            state.message && !staleCoverError
              ? translateError(state.message)
              : undefined
          }
          unmappedError={
            unmappedError ? translateError(unmappedError) : undefined
          }
          errors={feedback.errors}
          conflict={Boolean(state.conflict)}
          coverConflict={coverConflict}
          saved={Boolean(state.saved)}
          pending={pending}
          coverBusy={coverBusy}
          dirty={dirty}
          coverDirty={Boolean(edit) && coverDirty}
          validationAttempted={validationAttempted}
          requiredMissing={requiredMissing}
          disabled={disabled || creationUncertain || (!edit && coverUnprepared)}
          onShowErrors={() => revealErrors(feedback.errors)}
          onCheckRequired={checkRequiredFields}
        />
      )}
    </Stack>
  );
}
