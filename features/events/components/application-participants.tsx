import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import type { ApplicationIssue } from "@/features/events/application-input";
import { ApplicationQuestions } from "@/features/events/components/application-questions";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";
import type { useFormFeedback } from "@/hooks/use-form-feedback";

type ParticipantFields = {
  fields: EventSnapshot["registrationForm"]["fields"];
  values: Record<string, string[]>;
  feedback: Pick<
    ReturnType<typeof useFormFeedback<ApplicationIssue>>,
    "errors" | "field"
  >;
  update: (name: string, value: string[]) => void;
  pending: boolean;
  preview: boolean;
  selectPlaceholders: { chooseOption: string; noSelection: string };
};

export function ApplicantDetails({
  applicant,
  values,
  feedback,
  update,
  pending,
  preview,
}: Pick<
  ParticipantFields,
  "values" | "feedback" | "update" | "pending" | "preview"
> & {
  applicant?: { name: string; email: string };
}) {
  const t = useTranslations("events");

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-labelledby="applicant-details-title"
      sx={{ p: { xs: 2.5, sm: 4 } }}
    >
      <Stack spacing={3}>
        <Box>
          <Typography id="applicant-details-title" variant="h6" component="h2">
            {t("yourDetails")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
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
                ? t(feedback.errors.email.code, feedback.errors.email.values)
                : undefined) ?? (applicant ? t("verifiedEmailHint") : undefined)
            }
            slotProps={{ input: { readOnly: preview || !!applicant } }}
          />
        </Stack>
      </Stack>
    </Paper>
  );
}

export function ApplicantQuestions({
  fields,
  values,
  feedback,
  update,
  pending,
  preview,
  selectPlaceholders,
}: ParticipantFields) {
  const t = useTranslations("events");

  return (
    <>
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
    </>
  );
}

export function ApplicationGuests({
  fields,
  values,
  feedback,
  update,
  pending,
  preview,
  selectPlaceholders,
  maxGuestsPerRegistration,
  guestKeys,
  onAdd,
  onRemove,
}: ParticipantFields & {
  maxGuestsPerRegistration: number;
  guestKeys: number[];
  onAdd: () => void;
  onRemove: (key: number) => void;
}) {
  const t = useTranslations("events");

  return (
    <>
      {maxGuestsPerRegistration > 0 && (
        <Stack component="section" spacing={3}>
          <Typography variant="h5" component="h2">
            {t("declaredGuests")}
          </Typography>
          <Alert severity="info">
            {t("declareGuestsHint", {
              count: maxGuestsPerRegistration,
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
                    onClick={() => onRemove(key)}
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
                  required
                  label={t("email")}
                  type="email"
                  value={values[`guest:${key}:email`]?.[0] ?? ""}
                  disabled={pending || preview}
                  onChange={(event) =>
                    update(`guest:${key}:email`, [event.target.value])
                  }
                  {...feedback.field(`guest:${key}:email`)}
                />
                <ApplicationQuestions
                  fields={fields}
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
          {guestKeys.length < maxGuestsPerRegistration && (
            <Button
              variant="outlined"
              disabled={pending || preview}
              sx={{ alignSelf: "flex-start" }}
              onClick={onAdd}
            >
              {t("addGuest")}
            </Button>
          )}
        </Stack>
      )}
    </>
  );
}
