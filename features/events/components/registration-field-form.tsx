"use client";

import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  type BuilderField,
  type FieldType,
  fieldTypeLabels,
  isChoice,
  type RegistrationFieldInput,
  registrationFieldIssue,
  registrationFieldSchema,
} from "@/features/events/schemas/registration-form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import type { Messages } from "@/lib/i18n/messages";

export function RegistrationFieldForm({
  initial,
  pending,
  message,
  fieldErrors,
  conflict,
  reloadHref,
  onSave,
  onCancel,
}: {
  initial?: BuilderField;
  pending: boolean;
  message?: keyof Messages["events"];
  fieldErrors?: Record<string, keyof Messages["events"]>;
  conflict?: boolean;
  reloadHref: string;
  onSave: (field: RegistrationFieldInput) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("events");
  const feedback = useFormFeedback<keyof Messages["events"]>({}, (code) =>
    t(code),
  );
  const { setErrors, setMessage } = feedback;

  useEffect(() => {
    setErrors(fieldErrors ?? {});
    setMessage(message);
  }, [fieldErrors, message, setErrors, setMessage]);
  const [label, setLabel] = useState(initial?.label ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<FieldType>(initial?.type ?? "SHORT_TEXT");
  const [required, setRequired] = useState(initial?.required ?? false);
  const [options, setOptions] = useState(
    () =>
      initial?.options.map((option, index) => ({
        ...option,
        key: String(index),
      })) ?? [],
  );

  function moveOption(index: number, offset: number) {
    feedback.clear("options");
    setOptions((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];

      return next;
    });
  }

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        feedback.reset();
        const input = {
          label,
          description,
          type,
          required,
          ...(isChoice(type)
            ? { options: options.map((option) => ({ label: option.label })) }
            : {}),
        };
        const parsed = registrationFieldSchema.safeParse(input);

        if (!parsed.success) {
          const errors: Record<string, keyof Messages["events"]> = {};

          for (const issue of parsed.error.issues) {
            errors[issue.path.join(".")] ??= registrationFieldIssue(issue);
          }
          feedback.setErrors(errors);

          return;
        }

        if (!pending && !conflict) {
          onSave(input);
        }
      }}
    >
      <DialogContent>
        <Stack spacing={2.5}>
          <TextField
            autoFocus
            label={t("question")}
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              feedback.clear("label");
            }}
            {...feedback.field("label")}
            required
            fullWidth
            disabled={pending}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <TextField
            select
            label={t("commType")}
            value={type}
            disabled={pending}
            {...feedback.field("type")}
            onChange={(event) => {
              const next = event.target.value as FieldType;
              setType(next);
              feedback.clear("type");
              feedback.clear("options");

              if (!isChoice(next)) {
                setOptions([]);
              } else if (!isChoice(type)) {
                setOptions([
                  { key: crypto.randomUUID(), label: "" },
                  { key: crypto.randomUUID(), label: "" },
                ]);
              }
            }}
          >
            {Object.entries(fieldTypeLabels).map(([value, title]) => (
              <MenuItem key={value} value={value}>
                {t(title)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("questionHelper")}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              feedback.clear("description");
            }}
            {...feedback.field("description")}
            multiline
            minRows={2}
            fullWidth
            disabled={pending}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={required}
                onChange={(event) => setRequired(event.target.checked)}
                disabled={pending}
              />
            }
            label={t("questionRequiredLabel")}
          />
          {isChoice(type) && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle1">
                {t("questionOptions")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("questionOptionsHint")}
              </Typography>
              {feedback.errors.options && (
                <Alert severity="error">{t(feedback.errors.options)}</Alert>
              )}
              {options.map((option, index) => (
                <Stack
                  key={option.key}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ alignItems: { sm: "center" } }}
                >
                  <TextField
                    label={t("questionOption", { number: index + 1 })}
                    value={option.label}
                    {...feedback.field(`options.${index}.label`)}
                    onChange={(event) => {
                      feedback.clear(`options.${index}.label`);
                      feedback.setErrors((current) => {
                        const next = { ...current };
                        delete next.options;

                        return next;
                      });
                      setOptions((current) =>
                        current.map((item) =>
                          item.key === option.key
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      );
                    }}
                    required
                    fullWidth
                    disabled={pending}
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                  />
                  <Stack direction="row">
                    <IconButton
                      aria-label={t("questionOptionUp", { number: index + 1 })}
                      disabled={pending || index === 0}
                      onClick={() => moveOption(index, -1)}
                    >
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                    <IconButton
                      aria-label={t("questionOptionDown", {
                        number: index + 1,
                      })}
                      disabled={pending || index === options.length - 1}
                      onClick={() => moveOption(index, 1)}
                    >
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                    <IconButton
                      aria-label={t("questionOptionRemove", {
                        number: index + 1,
                      })}
                      disabled={pending}
                      onClick={() => {
                        feedback.clear("options");
                        setOptions((current) =>
                          current.filter((item) => item.key !== option.key),
                        );
                      }}
                    >
                      <DeleteOutlined fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
              <Button
                onClick={() =>
                  setOptions((current) => [
                    ...current,
                    { key: crypto.randomUUID(), label: "" },
                  ])
                }
                disabled={pending}
                sx={{ alignSelf: "flex-start" }}
              >
                {t("questionOptionAdd")}
              </Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <Box sx={{ px: 3 }}>
        {" "}
        {(feedback.message || conflict) && (
          <Alert severity="error">
            {feedback.message ?? (message ? t(message) : undefined)}
            {conflict && (
              <Button component="a" color="inherit" href={reloadHref}>
                {t("reloadLatest")}
              </Button>
            )}
          </Alert>
        )}
      </Box>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onCancel} disabled={pending} color="inherit">
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={
            pending ||
            conflict ||
            !label.trim() ||
            (isChoice(type) &&
              (options.length < 2 ||
                options.some((option) => !option.label.trim())))
          }
        >
          {pending
            ? t("saving")
            : initial
              ? t("questionSaveChanges")
              : t("questionAdd")}
        </Button>
      </DialogActions>
    </Box>
  );
}
