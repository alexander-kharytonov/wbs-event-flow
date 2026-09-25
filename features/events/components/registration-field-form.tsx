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
import { useState } from "react";
import {
  type BuilderField,
  type FieldType,
  fieldTypeLabels,
  isChoice,
  type RegistrationFieldInput,
} from "@/features/events/schemas/registration-form";

export function RegistrationFieldForm({
  initial,
  pending,
  message,
  conflict,
  reloadHref,
  onSave,
  onCancel,
}: {
  initial?: BuilderField;
  pending: boolean;
  message?: string;
  conflict?: boolean;
  reloadHref: string;
  onSave: (field: RegistrationFieldInput) => void;
  onCancel: () => void;
}) {
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
    setOptions((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];

      return next;
    });
  }

  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          label,
          description,
          type,
          required,
          ...(isChoice(type)
            ? { options: options.map((option) => ({ label: option.label })) }
            : {}),
        });
      }}
    >
      <DialogContent>
        <Stack spacing={2.5}>
          {message && (
            <Alert severity="error">
              {message}
              {conflict && (
                <Button color="inherit" href={reloadHref}>
                  Reload latest version
                </Button>
              )}
            </Alert>
          )}
          <TextField
            autoFocus
            label="Question"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            fullWidth
            disabled={pending}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <TextField
            select
            label="Type"
            value={type}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value as FieldType;
              setType(next);

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
                {title}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Helper text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
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
            label="Required"
          />
          {isChoice(type) && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle1">Options</Typography>
              <Typography variant="body2" color="text.secondary">
                Add at least two distinct options. Their order here is the order
                in the form.
              </Typography>
              {options.map((option, index) => (
                <Stack
                  key={option.key}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ alignItems: { sm: "center" } }}
                >
                  <TextField
                    label={`Option ${index + 1}`}
                    value={option.label}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((item) =>
                          item.key === option.key
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      )
                    }
                    required
                    fullWidth
                    disabled={pending}
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                  />
                  <Stack direction="row">
                    <IconButton
                      aria-label={`Move option ${index + 1} up`}
                      disabled={pending || index === 0}
                      onClick={() => moveOption(index, -1)}
                    >
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                    <IconButton
                      aria-label={`Move option ${index + 1} down`}
                      disabled={pending || index === options.length - 1}
                      onClick={() => moveOption(index, 1)}
                    >
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                    <IconButton
                      aria-label={`Remove option ${index + 1}`}
                      disabled={pending}
                      onClick={() =>
                        setOptions((current) =>
                          current.filter((item) => item.key !== option.key),
                        )
                      }
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
                Add option
              </Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onCancel} disabled={pending} color="inherit">
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={pending || conflict}
        >
          {pending ? "Saving…" : initial ? "Save changes" : "Add question"}
        </Button>
      </DialogActions>
    </Box>
  );
}
