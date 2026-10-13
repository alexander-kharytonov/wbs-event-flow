"use client";

import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Button,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { type RefObject, useState } from "react";

export function EventPasswordFields({
  enabled,
  saved,
  filled,
  input,
  disabled,
  error,
  onToggle,
  onInput,
}: {
  enabled: boolean;
  saved: boolean;
  filled: boolean;
  input: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  error?: string;
  onToggle: (enabled: boolean) => void;
  onInput: () => void;
}) {
  const t = useTranslations("events");
  const [visible, setVisible] = useState(false);
  const [copyResult, setCopyResult] = useState<
    "accessCopied" | "accessCopyFailed" | null
  >(null);

  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            disabled={disabled}
            onChange={(_, checked) => {
              setVisible(false);
              setCopyResult(null);
              onToggle(checked);
            }}
          />
        }
        label={t("accessProtect")}
      />
      {enabled && (
        <>
          <TextField
            inputRef={input}
            name="eventPassword"
            type={visible ? "text" : "password"}
            label={t(saved ? "accessReplacement" : "accessPassword")}
            autoComplete="new-password"
            required={!saved}
            disabled={disabled}
            error={Boolean(error)}
            helperText={
              error ?? t(saved ? "accessSavedHint" : "accessPasswordHint")
            }
            onChange={() => {
              setCopyResult(null);
              onInput();
            }}
            slotProps={{
              inputLabel: { shrink: true },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      type="button"
                      edge="end"
                      disabled={disabled}
                      aria-label={t(visible ? "accessHide" : "accessShow")}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              type="button"
              disabled={disabled}
              onClick={() => {
                const bytes = crypto.getRandomValues(new Uint8Array(18));

                if (input.current)
                  input.current.value = btoa(String.fromCharCode(...bytes))
                    .replaceAll("+", "-")
                    .replaceAll("/", "_");
                setCopyResult(null);
                onInput();
              }}
            >
              {t("accessGenerate")}
            </Button>
            <Button
              type="button"
              startIcon={<ContentCopyOutlined />}
              disabled={disabled || !filled}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    input.current?.value ?? "",
                  );
                  setCopyResult("accessCopied");
                } catch {
                  setCopyResult("accessCopyFailed");
                }
              }}
            >
              {t("accessCopy")}
            </Button>
          </Stack>
          {copyResult && (
            <Alert
              severity={copyResult === "accessCopied" ? "success" : "warning"}
            >
              {t(copyResult)}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            {t("accessSavePublishHint")}
          </Typography>
        </>
      )}
    </Stack>
  );
}
