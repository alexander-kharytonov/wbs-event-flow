"use client";

import ArrowForward from "@mui/icons-material/ArrowForward";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
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
import { EmptyState } from "@/components/ui/empty-state";
import {
  type ApplicationFormState,
  type ApplicationIssue,
  applicationAnswersSchema,
  applicationGuestsSchema,
  applicationInputSchema,
  applicationIssue,
  guestIssue,
  guestIssueKey,
} from "@/features/events/application-input";
import { ApplicationQuestions } from "@/features/events/components/application-questions";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";
import { submitApplication } from "@/features/events/submit-application-action";
import { useFormFeedback } from "@/hooks/use-form-feedback";

export function RegistrationApplicationForm({
  publicId = "",
  eventRevisionId: currentRevisionId = "",
  preview = false,
  fields: currentFields,
  guestConfiguration: currentGuestConfiguration,
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
  guestConfiguration: Pick<
    EventSnapshot,
    "guestPolicy" | "guestForm" | "maxGuestsPerRegistration"
  >;
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
    guestConfiguration: currentGuestConfiguration,
    selectPlaceholders: currentSelectPlaceholders,
  }));
  const guestConfiguration = preview
    ? currentGuestConfiguration
    : openedForm.guestConfiguration;
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
  const [guestKeys, setGuestKeys] = useState<number[]>([]);
  const nextGuestKey = useRef(0);
  const guestValues = () =>
    guestKeys.map((key) => ({
      name: values[`guest:${key}:name`]?.[0] ?? "",
      email: values[`guest:${key}:email`]?.[0] ?? "",
      answers: Object.fromEntries(
        guestConfiguration.guestForm.fields.map((field) => [
          field.id,
          values[`guest:${key}:answers:${field.id}`] ?? [],
        ]),
      ),
    }));
  const mapGuestErrors = (errors: Record<string, ApplicationIssue>) =>
    Object.fromEntries(
      Object.entries(errors).map(([key, value]) => {
        const match = /^guest:(\d+):(.*)$/.exec(key);

        return [
          match ? `guest:${guestKeys[Number(match[1])]}:${match[2]}` : key,
          value,
        ];
      }),
    );
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
        guestConfiguration.guestForm.fields.every(
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
        guestConfiguration.guestForm.fields.some(
          (field) => name === `guest:${key}:answers:${field.id}`,
        ),
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
    const errors: Record<string, ApplicationIssue> = {};

    if (preview) {
      return errors;
    }
    const input = applicationInputSchema.safeParse({
      publicId,
      eventRevisionId,
      guests: guestValues(),
      fullName: values.fullName?.[0] ?? applicant?.name ?? "",
      email: applicant?.email ?? values.email?.[0] ?? "",
      answers: Object.fromEntries(
        fields.map((field) => [field.id, values[`answer:${field.id}`] ?? []]),
      ),
    });

    if (!input.success) {
      for (const issue of input.error.issues) {
        errors[String(issue.path[0])] ??= applicationIssue(issue);
      }
    }
    const answers = applicationAnswersSchema({
      registrationForm: { fields },
    }).safeParse(
      Object.fromEntries(
        fields.map((field) => [field.id, values[`answer:${field.id}`] ?? []]),
      ),
    );

    if (!answers.success) {
      for (const issue of answers.error.issues) {
        errors[`answer:${String(issue.path[0])}`] ??= applicationIssue(issue);
      }
    }

    const guests = applicationGuestsSchema(guestConfiguration).safeParse(
      guestValues(),
    );

    if (!guests.success) {
      Object.assign(
        errors,
        mapGuestErrors(
          Object.fromEntries(
            guests.error.issues.map((issue) => [
              guestIssueKey(issue),
              guestIssue(issue),
            ]),
          ),
        ),
      );
    }

    return errors;
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
        <Paper
          variant="outlined"
          component="section"
          aria-labelledby="applicant-details-title"
          sx={{ p: { xs: 2.5, sm: 4 } }}
        >
          <Stack spacing={3}>
            <Box>
              <Typography
                id="applicant-details-title"
                variant="h6"
                component="h2"
              >
                {t("yourDetails")}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.75 }}
              >
                {t("requiredFieldsHint")}
              </Typography>
            </Box>
            <Stack spacing={3}>
              <TextField
                disabled={pending}
                name="fullName"
                label={t("fullName")}
                autoComplete="name"
                required
                fullWidth
                value={values.fullName?.[0] ?? applicant?.name ?? ""}
                onChange={(event) => update("fullName", [event.target.value])}
                error={!!feedback.errors.fullName}
                helperText={feedback.field("fullName").helperText}
                slotProps={{
                  input: { readOnly: preview },
                  htmlInput: { maxLength: 200 },
                }}
              />
              <TextField
                disabled={pending}
                name="email"
                label={t("email")}
                type="email"
                autoComplete="email"
                required
                fullWidth
                value={applicant?.email ?? values.email?.[0] ?? ""}
                onChange={(event) => update("email", [event.target.value])}
                error={!!feedback.errors.email}
                helperText={
                  (feedback.errors.email
                    ? t(
                        feedback.errors.email.code,
                        feedback.errors.email.values,
                      )
                    : undefined) ??
                  (applicant ? t("verifiedEmailHint") : undefined)
                }
                slotProps={{ input: { readOnly: preview || !!applicant } }}
              />
            </Stack>
          </Stack>
        </Paper>
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
      {fields.length > 0 && (
        <Box
          component="section"
          aria-labelledby="application-questions-title"
          sx={{ px: { xs: 0.5, sm: 4 } }}
        >
          <Stack spacing={3.5}>
            <Box>
              <Typography
                id="application-questions-title"
                variant="h5"
                component="h2"
              >
                {t("registrationQuestions")}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.75 }}
              >
                {t("organizerQuestionsCount", { count: fields.length })}
              </Typography>
            </Box>
            <Stack
              spacing={{ xs: 3, sm: 3.5 }}
              sx={{
                "& .MuiFormControl-root": { minWidth: 0 },
                "& .MuiFormControlLabel-label": {
                  overflowWrap: "anywhere",
                },
                "& .MuiFormHelperText-root": { overflowWrap: "anywhere" },
              }}
            >
              <ApplicationQuestions
                fields={fields}
                values={values}
                errors={feedback.errors}
                update={update}
                pending={pending}
                preview={preview}
                selectPlaceholders={selectPlaceholders}
              />
            </Stack>
          </Stack>
        </Box>
      )}
      <input
        type="hidden"
        name="guests"
        value={JSON.stringify(guestValues())}
      />
      {guestConfiguration.guestPolicy === "APPROVAL_REQUIRED" && (
        <Stack component="section" spacing={3}>
          <Typography variant="h5" component="h2">
            {t("declaredGuests")}
          </Typography>
          <Alert severity="info">
            {t("declareGuestsHint", {
              count: guestConfiguration.maxGuestsPerRegistration,
            })}
          </Alert>
          {guestKeys.length === 0 && (
            <EmptyState
              icon={<PeopleOutlined />}
              title={t("noGuests")}
              description={t("noDeclaredGuestsHint")}
            />
          )}
          {guestKeys.map((key, index) => (
            <Paper variant="outlined" key={key} sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack spacing={3}>
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <Typography variant="h6" component="h3">
                    {t("declaredGuestNumber", { count: index + 1 })}
                  </Typography>
                  <Button
                    disabled={pending || preview}
                    color="error"
                    onClick={() => {
                      setGuestKeys((current) =>
                        current.filter((value) => value !== key),
                      );
                      feedback.setErrors(
                        Object.fromEntries(
                          Object.entries(feedback.errors).filter(
                            ([name]) => !name.startsWith(`guest:${key}:`),
                          ),
                        ),
                      );
                    }}
                  >
                    {t("removeGuest")}
                  </Button>
                </Stack>
                <TextField
                  required
                  label={t("fullName")}
                  value={values[`guest:${key}:name`]?.[0] ?? ""}
                  disabled={pending || preview}
                  onChange={(event) =>
                    update(`guest:${key}:name`, [event.target.value])
                  }
                  {...feedback.field(`guest:${key}:name`)}
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
                <TextField
                  label={t("guestEmailOptional")}
                  type="email"
                  value={values[`guest:${key}:email`]?.[0] ?? ""}
                  disabled={pending || preview}
                  onChange={(event) =>
                    update(`guest:${key}:email`, [event.target.value])
                  }
                  {...feedback.field(`guest:${key}:email`)}
                />
                <ApplicationQuestions
                  fields={guestConfiguration.guestForm.fields}
                  values={values}
                  errors={feedback.errors}
                  update={update}
                  pending={pending}
                  preview={preview}
                  prefix={`guest:${key}:answers:`}
                  formNames={false}
                  selectPlaceholders={selectPlaceholders}
                />
              </Stack>
            </Paper>
          ))}
          {guestKeys.length < guestConfiguration.maxGuestsPerRegistration && (
            <Button
              variant="outlined"
              disabled={pending || preview}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => {
                const key = nextGuestKey.current++;
                setGuestKeys((current) => [...current, key]);
              }}
            >
              {t("addGuest")}
            </Button>
          )}
        </Stack>
      )}
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
