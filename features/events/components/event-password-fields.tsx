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
import { type RefObject, useEffect, useRef, useState } from "react";
import { EventText } from "@/features/events/components/event-text";
import { useNotifications } from "@/hooks/use-notifications";

export function EventPasswordFields({
  enabled,
  saved,
  savedEvent,
  filled,
  input,
  disabled,
  error,
  onToggle,
  onInput,
}: {
  enabled: boolean;
  saved: boolean;
  savedEvent?: { id: string; version: string };
  filled: boolean;
  input: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  error?: string;
  onToggle: (enabled: boolean) => void;
  onInput: () => void;
}) {
  const t = useTranslations("events");
  const notifications = useNotifications();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showingSaved, setShowingSaved] = useState(false);
  const [pending, setPending] = useState<"show" | "copy" | null>(null);
  const [loadError, setLoadError] = useState<
    "accessSavedLoadFailed" | "accessSavedUnavailable" | null
  >(null);
  const request = useRef<AbortController | null>(null);
  const savedValueShown = useRef(false);
  const savedId = savedEvent?.id;
  const savedVersion = savedEvent?.version;

  // biome-ignore lint/correctness/useExhaustiveDependencies: These are credential invalidation boundaries, including leaving Access and starting a save.
  useEffect(() => {
    if (savedValueShown.current && input.current) {
      input.current.value = "";
    }
    savedValueShown.current = false;
    setShowingSaved(false);
    setVisible(false);
    setPending(null);
    setLoadError(null);

    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [input, savedId, savedVersion, disabled, enabled]);

  function cancelPasswordRequest() {
    request.current?.abort();
    request.current = null;
    setPending(null);
    setLoadError(null);
  }

  async function readSavedPassword(controller: AbortController) {
    if (!saved || !savedId || !savedVersion) {
      return;
    }

    try {
      const response = await fetch(`/api/events/${savedId}/password`, {
        method: "POST",
        headers: { "X-Event-Version": savedVersion },
        cache: "no-store",
        signal: controller.signal,
      });
      const result = await response.json();

      if (controller.signal.aborted) {
        return;
      }

      if (response.ok && typeof result.password === "string") {
        return result.password as string;
      }
      setLoadError(
        result.code === "accessSavedUnavailable"
          ? "accessSavedUnavailable"
          : "accessSavedLoadFailed",
      );
    } catch {
      if (!controller.signal.aborted) {
        setLoadError("accessSavedLoadFailed");
      }
    }
  }

  async function showPassword() {
    if (filled) {
      setVisible(true);

      return;
    }

    if (request.current) {
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending("show");
    setLoadError(null);
    const password = await readSavedPassword(controller);

    if (password !== undefined && !controller.signal.aborted && input.current) {
      input.current.value = password;
      savedValueShown.current = true;
      setShowingSaved(true);
      setVisible(true);
    }

    if (request.current === controller) {
      request.current = null;
      setPending(null);
    }
  }

  async function copyPassword() {
    if (request.current) {
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending("copy");
    setLoadError(null);
    let loadFailed = false;

    try {
      if (filled || showingSaved) {
        await navigator.clipboard.writeText(input.current?.value ?? "");
      } else {
        // Start the clipboard operation during the click; resolve its contents
        // after the authenticated request, without revealing them in the input.
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": readSavedPassword(controller).then((password) => {
              if (password === undefined || controller.signal.aborted) {
                loadFailed = true;

                throw new Error("Saved password unavailable.");
              }

              return new Blob([password], { type: "text/plain" });
            }),
          }),
        ]);
      }

      if (!controller.signal.aborted) {
        notifications.show(<EventText id="accessCopied" />, {
          severity: "success",
          key: "copy-event-password",
        });
      }
    } catch {
      if (!controller.signal.aborted && !loadFailed) {
        notifications.show(<EventText id="accessCopyFailed" />, {
          severity: "error",
          key: "copy-event-password",
        });
      }
    } finally {
      controller.abort();

      if (request.current === controller) {
        request.current = null;
        setPending(null);
      }
    }
  }

  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            disabled={disabled}
            onChange={(_, checked) => {
              cancelPasswordRequest();
              setVisible(false);
              onToggle(checked);
            }}
          />
        }
        label={t("accessProtect")}
      />
      {enabled && (
        <>
          {/* Revealing the saved value never submits it as a replacement. */}
          {showingSaved && (
            <input type="hidden" name="eventPassword" value="" />
          )}
          <TextField
            inputRef={input}
            name={showingSaved ? undefined : "eventPassword"}
            type={visible ? "text" : "password"}
            label={t("accessPassword")}
            placeholder={saved ? "••••••••" : undefined}
            autoComplete="new-password"
            required={!saved}
            disabled={disabled}
            error={Boolean(error)}
            helperText={
              error ?? t(saved ? "accessSavedHint" : "accessPasswordHint")
            }
            onChange={() => {
              cancelPasswordRequest();
              savedValueShown.current = false;
              setShowingSaved(false);
              onInput();
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            slotProps={{
              inputLabel: { shrink: focused || filled || saved },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      type="button"
                      edge="end"
                      aria-label={t(visible ? "accessHide" : "accessShow")}
                      disabled={
                        disabled ||
                        pending !== null ||
                        (!filled && !(saved && savedEvent))
                      }
                      loading={pending === "show"}
                      onClick={() => {
                        if (!visible) {
                          void showPassword();

                          return;
                        }

                        if (savedValueShown.current && input.current) {
                          input.current.value = "";
                          savedValueShown.current = false;
                          setShowingSaved(false);
                        }
                        setVisible(false);
                      }}
                    >
                      {visible ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {loadError && <Alert severity="warning">{t(loadError)}</Alert>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              type="button"
              disabled={disabled}
              onClick={() => {
                cancelPasswordRequest();
                const bytes = crypto.getRandomValues(new Uint8Array(18));

                if (input.current) {
                  input.current.value = btoa(String.fromCharCode(...bytes))
                    .replaceAll("+", "-")
                    .replaceAll("/", "_");
                }
                savedValueShown.current = false;
                setShowingSaved(false);
                onInput();
              }}
            >
              {t(saved ? "accessGenerateNew" : "accessGenerate")}
            </Button>
            <Button
              type="button"
              startIcon={<ContentCopyOutlined />}
              disabled={
                disabled ||
                pending !== null ||
                (!filled && !showingSaved && !(saved && savedEvent))
              }
              loading={pending === "copy"}
              onClick={copyPassword}
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
