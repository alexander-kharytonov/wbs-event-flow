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
} from "@mui/material";
import { useTranslations } from "next-intl";
import { type RefObject, useState } from "react";
import { EventText } from "@/features/events/components/event-text";
import { useNotifications } from "@/hooks/use-notifications";

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
  const notifications = useNotifications();
  const [focused, setFocused] = useState(false);

  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            disabled={disabled}
            onChange={(_, checked) => {
              setVisible(false);
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
              onInput();
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            slotProps={{
              inputLabel: { shrink: focused || filled },
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
                  notifications.show(<EventText id="accessCopied" />, {
                    severity: "success",
                    key: "copy-event-password",
                    autoHideDuration: 3000,
                  });
                } catch {
                  notifications.show(<EventText id="accessCopyFailed" />, {
                    severity: "error",
                    key: "copy-event-password",
                  });
                }
              }}
            >
              {t("accessCopy")}
            </Button>
          </Stack>
          <Alert severity="info">{t("accessSavePublishHint")}</Alert>
        </>
      )}
    </Stack>
  );
}
