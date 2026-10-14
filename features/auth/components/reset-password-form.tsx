"use client";

import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { AuthText } from "@/features/auth/components/auth-text";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import { authClient } from "@/lib/auth-client";
import type { Messages } from "@/lib/i18n/messages";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const feedback = useFormFeedback<keyof Messages["auth"]>({}, t);
  const notifications = useNotifications();
  const token = useRef("");
  const initialized = useRef(false);
  const inFlight = useRef(false);
  const [state, setState] = useState<
    "loading" | "ready" | "invalid" | "success"
  >("loading");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const fragment = window.location.hash.slice(1);
      // Keep the bearer only in this mounted form, never history or browser storage.
      window.history.replaceState(null, "", "/reset-password");
      token.current = /^[A-Za-z0-9]{24}$/.test(fragment) ? fragment : "";
      setState(token.current ? "ready" : "invalid");
    }

    const openAnotherLink = () => {
      // An email link opened in this same tab can be a fragment-only navigation.
      // Remount for the new link without disturbing the keyboard skip link.
      if (window.location.hash && window.location.hash !== "#main-content") {
        window.location.reload();
      }
    };
    window.addEventListener("hashchange", openAnotherLink);

    return () => window.removeEventListener("hashchange", openAnotherLink);
  }, []);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (inFlight.current || state !== "ready") {
      return;
    }

    feedback.reset();
    const errors: Record<string, keyof Messages["auth"]> = {};

    if (password.length < 10 || password.length > 128) {
      errors.password = "passwordLength";
    }

    if (confirmation !== password) {
      errors.confirmation = "passwordMismatch";
    }
    feedback.setErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    inFlight.current = true;
    setPending(true);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token: token.current,
      });

      if (result.error) {
        if (
          result.error.code === "INVALID_TOKEN" ||
          result.error.code === "USER_NOT_FOUND"
        ) {
          token.current = "";
          setPassword("");
          setConfirmation("");
          setState("invalid");
        } else if (
          ["PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG"].includes(
            result.error.code ?? "",
          )
        ) {
          feedback.setErrors({ password: "passwordLength" });
        } else {
          feedback.setMessage(
            result.error.status === 429 ? "resetThrottled" : "requestFailed",
          );
        }

        return;
      }

      token.current = "";
      setPassword("");
      setConfirmation("");
      setState("success");
      notifications.show(<AuthText id="resetSuccess" />, {
        severity: "success",
        key: "password-reset",
      });
    } catch {
      feedback.setMessage("connectionFailed");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        width: "100%",
        maxWidth: 480,
        mx: "auto",
        my: "auto",
        p: { xs: 3, sm: 4 },
      }}
    >
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4" component="h1">
            {t("resetPasswordTitle")}
          </Typography>
          <Typography color="text.secondary">
            {t("resetPasswordDescription")}
          </Typography>
        </Stack>
        {state === "loading" && (
          <Typography role="status">{t("pleaseWait")}</Typography>
        )}
        {state === "invalid" && (
          <>
            <Alert severity="warning">{t("invalidResetLink")}</Alert>
            <Button href="/forgot-password" variant="contained">
              {t("requestNewLink")}
            </Button>
          </>
        )}
        {state === "success" && (
          <Alert severity="success" role="status">
            {t("resetSuccess")}
          </Alert>
        )}
        {state === "ready" && (
          <Stack
            component="form"
            noValidate
            spacing={2.5}
            onSubmit={submit}
            aria-busy={pending}
          >
            <TextField
              label={t("newPassword")}
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                feedback.clear("password");
              }}
              {...feedback.field("password")}
              helperText={
                feedback.errors.password
                  ? t(feedback.errors.password)
                  : t("passwordLength")
              }
              disabled={pending}
              required
              fullWidth
            />
            <TextField
              label={t("confirmPassword")}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                feedback.clear("confirmation");
              }}
              {...feedback.field("confirmation")}
              disabled={pending}
              required
              fullWidth
            />
            {feedback.message && (
              <Alert severity="error">{feedback.message}</Alert>
            )}
            <Button
              type="submit"
              variant="contained"
              loading={pending}
              disabled={pending || !password || !confirmation}
            >
              {t(pending ? "pleaseWait" : "resetPasswordTitle")}
            </Button>
          </Stack>
        )}
        <Button href="/sign-in">{t("backSignIn")}</Button>
      </Stack>
    </Paper>
  );
}
