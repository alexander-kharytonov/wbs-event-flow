"use client";

import ArrowForward from "@mui/icons-material/ArrowForward";
import SendOutlined from "@mui/icons-material/SendOutlined";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  type ReactNode,
  type SyntheticEvent,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { BackLink } from "@/components/ui/back-link";
import { validateApplicationFields } from "@/features/events/application-form-validation";
import type {
  ApplicationFormState,
  ApplicationIssue,
} from "@/features/events/application-input";
import {
  ApplicantDetails,
  ApplicantQuestions,
  ApplicationGuests,
} from "@/features/events/components/application-participants";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";
import { submitApplication } from "@/features/events/submit-application-action";
import { useApplicationGuests } from "@/features/events/use-application-guests";
import { useFormFeedback } from "@/hooks/use-form-feedback";

export function RegistrationApplicationForm({
  publicId = "",
  eventRevisionId: currentRevisionId = "",
  preview = false,
  fields: currentFields,
  maxGuestsPerRegistration: currentMaxGuestsPerRegistration,
  selectPlaceholders: currentSelectPlaceholders,
  reapplication = false,
  applicant,
  eventContext,
  initialValues = {},
}: {
  applicant?: { name: string; email: string };
  reapplication?: boolean;
  eventContext: ReactNode;
  initialValues?: Record<string, string[]>;
  fields: EventSnapshot["registrationForm"]["fields"];
  maxGuestsPerRegistration: number;
  selectPlaceholders: { chooseOption: string; noSelection: string };
} & (
  | { preview: true; publicId?: never; eventRevisionId?: never }
  | { preview?: false; publicId: string; eventRevisionId: string }
)) {
  const t = useTranslations("events");
  // Keep the opened question definitions and revision together across server refreshes.
  // The parent unmounts this component when current eligibility is lost.
  const [openedForm] = useState(() => ({
    eventRevisionId: currentRevisionId,
    fields: currentFields,
    maxGuestsPerRegistration: currentMaxGuestsPerRegistration,
    selectPlaceholders: currentSelectPlaceholders,
  }));
  const maxGuestsPerRegistration = preview
    ? currentMaxGuestsPerRegistration
    : openedForm.maxGuestsPerRegistration;
  const fields = preview ? currentFields : openedForm.fields;
  const selectPlaceholders = preview
    ? currentSelectPlaceholders
    : openedForm.selectPlaceholders;
  const eventRevisionId = preview
    ? currentRevisionId
    : openedForm.eventRevisionId;
  const formChanged = !preview && currentRevisionId !== eventRevisionId;
  const mustRestart = reapplication && formChanged;
  const feedback = useFormFeedback<ApplicationIssue>({}, (issue) =>
    t(issue.code, issue.values),
  );
  const router = useRouter();
  const formRef = useRef<HTMLElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const focusFirstError = () => setFocusRequest((current) => current + 1);
  // Keep entered values on errors; discard them only after server success.
  const [values, setValues] = useState<Record<string, string[]>>(initialValues);
  const { guestKeys, guestValues, mapGuestErrors, addGuest, removeGuest } =
    useApplicationGuests(values, fields, feedback.errors, feedback.setErrors);
  const [state, action, pending] = useActionState(
    async (previous: ApplicationFormState, formData: FormData) => {
      if (preview || mustRestart || !publicId || !eventRevisionId) {
        return {};
      }

      const next = await submitApplication(
        publicId,
        eventRevisionId,
        previous,
        formData,
      );

      if (next.success) {
        setValues({});

        if (applicant) {
          router.refresh();
        }
      }
      feedback.setErrors(mapGuestErrors(next.errors ?? {}));
      feedback.setMessage(next.message);

      if (!next.success && next.errors) {
        focusFirstError();
      }

      return next;
    },
    {},
  );
  const update = (name: string, value: string[]) => {
    feedback.clear(name);
    setValues((previous) => ({ ...previous, [name]: value }));
  };
  const complete =
    Boolean((values.fullName?.[0] ?? applicant?.name ?? "").trim()) &&
    Boolean((applicant?.email ?? values.email?.[0] ?? "").trim()) &&
    guestKeys.every(
      (key) =>
        Boolean(values[`guest:${key}:name`]?.[0]?.trim()) &&
        Boolean(values[`guest:${key}:email`]?.[0]?.trim()) &&
        fields.every(
          (field) =>
            !field.required ||
            (values[`guest:${key}:answers:${field.id}`] ?? []).some((value) =>
              value.trim(),
            ),
        ),
    ) &&
    fields.every(
      (field) =>
        !field.required ||
        (values[`answer:${field.id}`] ?? []).some((value) => value.trim()),
    );

  const isFieldError = (name: string) =>
    name === "fullName" ||
    name === "email" ||
    fields.some((field) => name === `answer:${field.id}`) ||
    guestKeys.some(
      (key) =>
        name === `guest:${key}:name` ||
        name === `guest:${key}:email` ||
        fields.some((field) => name === `guest:${key}:answers:${field.id}`),
    );
  const hasFieldErrors = Object.keys(feedback.errors).some(isFieldError);

  useEffect(() => {
    if (!focusRequest || pending) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const target = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]:not([type="hidden"]):not([aria-hidden="true"])',
      );
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "center", behavior: "instant" });
      setFocusRequest(0);
    });

    return () => cancelAnimationFrame(frame);
  }, [focusRequest, pending]);

  function validateFields() {
    return validateApplicationFields({
      preview,
      publicId,
      eventRevisionId,
      fields,
      maxGuestsPerRegistration,
      values,
      applicant,
      guests: guestValues(),
      mapGuestErrors,
    });
  }

  function checkRequiredFields() {
    const errors = validateFields();
    feedback.setErrors(errors);

    if (Object.keys(errors).length) {
      focusFirstError();
    }
  }

  if (state.success) {
    return (
      <Stack spacing={3}>
        {eventContext}
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={3}>
            <Alert severity="success" role="status">
              <AlertTitle>{t("registrationReceived")}</AlertTitle>
              {t("applicationSubmitted")}
            </Alert>
            <Alert severity="info">{t("reviewBeforeAdmission")}</Alert>
            <BackLink href={`/e/${publicId}`}>{t("backEvent")}</BackLink>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack
      component={preview ? "div" : "form"}
      ref={(element: HTMLElement | null) => {
        formRef.current = element;
      }}
      aria-busy={pending}
      action={preview ? undefined : action}
      noValidate
      onSubmit={(event: SyntheticEvent<HTMLElement>) => {
        if (preview) {
          event.preventDefault();

          return;
        }
        feedback.reset();
        const errors = validateFields();

        if (pending || mustRestart || Object.keys(errors).length) {
          event.preventDefault();
          feedback.setErrors(errors);

          if (Object.keys(errors).length) {
            feedback.setMessage({ code: "checkHighlightedFields" });
            focusFirstError();
          }
        }
      }}
      onReset={(event: SyntheticEvent<HTMLElement>) => event.preventDefault()}
      spacing={{ xs: 4, sm: 5 }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
          },
          gap: 3,
          alignItems: "stretch",
        }}
      >
        {eventContext}
        <ApplicantDetails
          applicant={applicant}
          values={values}
          feedback={feedback}
          update={update}
          pending={pending}
          preview={preview}
        />
      </Box>
      {formChanged && (
        <Alert
          severity="info"
          sx={{
            flexWrap: { xs: "wrap", sm: "nowrap" },
            "& .MuiAlert-action": {
              width: { xs: "100%", sm: "auto" },
              pl: { xs: 0, sm: 2 },
              pt: { xs: 1, sm: 0 },
            },
          }}
          action={
            <Button
              color="inherit"
              disabled={pending}
              onClick={() => window.location.reload()}
            >
              {t("restartLatestForm")}
            </Button>
          }
        >
          {reapplication
            ? t("reapplicationFormChanged")
            : t("newerFormAvailable")}{" "}
          {t("restartClearsAnswers")}
        </Alert>
      )}
      <ApplicantQuestions
        fields={fields}
        values={values}
        feedback={feedback}
        update={update}
        pending={pending}
        preview={preview}
        selectPlaceholders={selectPlaceholders}
      />
      <input
        type="hidden"
        name="guests"
        value={JSON.stringify(guestValues())}
      />
      <ApplicationGuests
        fields={fields}
        values={values}
        feedback={feedback}
        update={update}
        pending={pending}
        preview={preview}
        selectPlaceholders={selectPlaceholders}
        maxGuestsPerRegistration={maxGuestsPerRegistration}
        guestKeys={guestKeys}
        onAdd={addGuest}
        onRemove={removeGuest}
      />
      {!preview && (
        <Paper
          variant="outlined"
          component="section"
          aria-label={t("submitApplication")}
          sx={{
            p: { xs: 2.5, sm: 4 },
            borderTop: 3,
            borderTopColor: "primary.main",
            bgcolor: "action.hover",
          }}
        >
          <Stack spacing={3}>
            {feedback.message && (
              <Alert severity="error">{feedback.message}</Alert>
            )}
            {Object.entries(feedback.errors)
              .filter(([name]) => !isFieldError(name))
              .map(([name, message]) => (
                <Alert severity="error" key={name}>
                  {t(message.code, message.values)}
                </Alert>
              ))}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={3}
              sx={{
                alignItems: { sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    color: "primary.main",
                    display: "flex",
                  }}
                >
                  <SendOutlined />
                </Box>
                <Typography variant="h5" component="h2">
                  {t("readyToJoin")}
                </Typography>
              </Stack>
              <Stack spacing={1} sx={{ flexShrink: 0 }}>
                {(!complete || hasFieldErrors) && (
                  <Button
                    type="button"
                    variant="outlined"
                    color={hasFieldErrors ? "error" : "primary"}
                    size="small"
                    disabled={pending}
                    onClick={
                      hasFieldErrors ? focusFirstError : checkRequiredFields
                    }
                  >
                    {hasFieldErrors
                      ? t("reviewErrors")
                      : t("completeRequiredFields")}
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={!complete || pending || mustRestart}
                  variant="contained"
                  loading={pending}
                  size="large"
                  endIcon={<ArrowForward />}
                  sx={{
                    flexShrink: 0,
                    minWidth: { sm: 220 },
                  }}
                >
                  {t("submitApplication")}
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
