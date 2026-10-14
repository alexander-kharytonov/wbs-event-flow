"use client";

import Google from "@mui/icons-material/Google";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import {
  Alert,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { BackLink } from "@/components/ui/back-link";
import {
  rememberVerificationEmail,
  startVerificationCooldown,
  verificationCallbackURL,
  verificationPath,
} from "@/features/auth/verification-flow";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { authClient } from "@/lib/auth-client";
import type { Messages } from "@/lib/i18n/messages";
import { safeReturnPath } from "@/lib/safe-return-path";

export function AuthForm({
  mode,
  notice,
  returnTo,
  googleEnabled = false,
  oauthError,
}: {
  mode: "register" | "sign-in";
  notice?: "signInNotice";
  returnTo?: string;
  googleEnabled?: boolean;
  oauthError?: string;
}) {
  const t = useTranslations("auth");
  const [googlePending, setGooglePending] = useState(false);
  const [googleFailed, setGoogleFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const router = useRouter();
  const requestInFlight = useRef(false);
  const feedback = useFormFeedback<keyof Messages["auth"]>({}, t);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const registering = mode === "register";
  const safeReturnTo = safeReturnPath(returnTo);
  const authQuery = safeReturnTo
    ? `?${new URLSearchParams({ returnTo: safeReturnTo })}`
    : "";
  const signInHref = `/sign-in${authQuery}`;
  const registerHref = `/register${authQuery}`;
  const callbackURL = safeReturnTo ?? "/account";

  useEffect(() => {
    const restore = () => {
      setGooglePending(false);
      requestInFlight.current = false;
    };
    window.addEventListener("pageshow", restore);

    return () => window.removeEventListener("pageshow", restore);
  }, []);

  async function continueWithGoogle() {
    if (requestInFlight.current) {
      return;
    }

    requestInFlight.current = true;
    setGooglePending(true);
    setGoogleFailed(false);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
        errorCallbackURL: registering ? registerHref : signInHref,
      });

      if (result.error) {
        setGoogleFailed(true);
        setGooglePending(false);
        requestInFlight.current = false;
      }
    } catch {
      setGoogleFailed(true);
      setGooglePending(false);
      requestInFlight.current = false;
    }
  }

  function showVerification(address: string, deliveryFailed = false) {
    rememberVerificationEmail(address);
    const path = verificationPath(safeReturnTo);
    router.push(
      deliveryFailed
        ? `${path}${path.includes("?") ? "&" : "?"}delivery=failed`
        : path,
    );
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requestInFlight.current) {
      return;
    }

    const errors: Record<string, keyof Messages["auth"]> = {};

    if (registering && !name.trim()) {
      errors.name = "enterName";
    }

    if (!z.email().safeParse(email.trim()).success) {
      errors.email = "invalidEmail";
    }

    if (password.length < 10 || password.length > 128) {
      errors.password = "passwordLength";
    }
    feedback.setErrors(errors);
    feedback.setMessage(undefined);

    if (Object.keys(errors).length) {
      return;
    }

    requestInFlight.current = true;
    const form = new FormData(event.currentTarget);
    setPending(true);

    try {
      const credentials = {
        email: String(form.get("email")),
        password: String(form.get("password")),
        callbackURL,
      };
      const result = registering
        ? await authClient.signUp.email({
            ...credentials,
            callbackURL: verificationCallbackURL(safeReturnTo),
            name: String(form.get("name")),
          })
        : await authClient.signIn.email(credentials);

      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          showVerification(credentials.email);

          return;
        }

        if (registering && result.error.status >= 500) {
          showVerification(credentials.email, true);

          return;
        }

        if (result.error.code === "INVALID_EMAIL") {
          feedback.setErrors({
            email: "invalidEmail",
          });
        } else if (
          ["PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG"].includes(
            result.error.code ?? "",
          )
        ) {
          feedback.setErrors({
            password: "passwordLength",
          });
        } else {
          feedback.setMessage(
            !registering && result.error.code === "INVALID_EMAIL_OR_PASSWORD"
              ? "invalidCredentials"
              : "requestFailed",
          );
        }

        return;
      }

      if (registering) {
        startVerificationCooldown();
        showVerification(credentials.email);
      }
    } catch {
      if (registering) {
        showVerification(String(form.get("email")), true);
      } else {
        feedback.setMessage("connectionFailed");
      }
    } finally {
      requestInFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Stack
      spacing={3}
      sx={{ width: "100%", maxWidth: 480, mx: "auto", my: "auto" }}
    >
      <BackLink href="/">{t("backHome")}</BackLink>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="h4" component="h1">
              {registering ? t("createYourAccount") : t("welcomeBack")}
            </Typography>
            <Typography color="text.secondary">
              {registering
                ? safeReturnTo
                  ? t("createToContinue")
                  : t("createDescription")
                : safeReturnTo
                  ? t("signInToEvent")
                  : t("signInDescription")}
            </Typography>
          </Stack>
          {notice && <Alert severity="info">{t(notice)}</Alert>}
          <Stack
            component="form"
            noValidate
            spacing={2.5}
            onSubmit={submit}
            aria-busy={pending}
          >
            {registering && (
              <TextField
                label={t("name")}
                value={name}
                disabled={pending || googlePending}
                {...feedback.field("name")}
                onChange={(event) => {
                  setName(event.target.value);
                  feedback.clear("name");
                }}
                name="name"
                autoComplete="name"
                required
                fullWidth
              />
            )}
            <TextField
              label={t("email")}
              name="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                feedback.clear("email");
              }}
              disabled={pending || googlePending}
              {...feedback.field("email")}
              autoComplete="email"
              required
              fullWidth
            />
            <TextField
              label={t("password")}
              value={password}
              disabled={pending || googlePending}
              error={Boolean(feedback.errors.password)}
              onChange={(event) => {
                setPassword(event.target.value);
                feedback.clear("password");
              }}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={registering ? "new-password" : "current-password"}
              slotProps={{
                htmlInput: { minLength: 10, maxLength: 128 },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={
                          showPassword ? t("hidePassword") : t("showPassword")
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((visible) => !visible)}
                        edge="end"
                      >
                        {showPassword ? (
                          <VisibilityOffOutlined />
                        ) : (
                          <VisibilityOutlined />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              helperText={
                (feedback.errors.password
                  ? t(feedback.errors.password)
                  : undefined) ??
                (registering ? t("passwordLength") : undefined)
              }
              required
              fullWidth
            />
            {!registering && (
              <Link href="/forgot-password" sx={{ alignSelf: "flex-end" }}>
                {t("forgotPassword")}
              </Link>
            )}
            {feedback.message && (
              <Alert severity="error">{feedback.message}</Alert>
            )}
            <Button
              type="submit"
              variant="contained"
              loading={pending}
              disabled={
                pending ||
                googlePending ||
                !email.trim() ||
                !password ||
                (registering && !name.trim())
              }
            >
              {pending
                ? t("pleaseWait")
                : registering
                  ? t("createAccount")
                  : t("signIn")}
            </Button>
            {registering && (
              <Typography variant="body2" color="text.secondary">
                {t("verificationRequired")}
              </Typography>
            )}
          </Stack>
          {googleEnabled && <Divider>{t("orGoogle")}</Divider>}
          {(oauthError || googleFailed) && (
            <Alert severity="error">
              {t(
                oauthError === "account_not_linked"
                  ? "googleCollision"
                  : oauthError === "access_denied"
                    ? "googleCancelled"
                    : "googleFailed",
              )}
            </Alert>
          )}
          {googleEnabled && (
            <Button
              variant="outlined"
              startIcon={<Google />}
              loading={googlePending}
              disabled={pending || googlePending}
              onClick={() => void continueWithGoogle()}
            >
              {t(registering ? "googleSignUp" : "googleContinue")}
            </Button>
          )}
          <Divider />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center" }}
          >
            {registering ? t("alreadyAccount") : t("newToEventFlow")}{" "}
            <Link href={registering ? signInHref : registerHref}>
              {registering ? t("signIn") : t("createAccount")}
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
