"use client";

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
import { useRef, useState } from "react";
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
import { safeReturnPath } from "@/lib/safe-return-path";

export function AuthForm({
  mode,
  notice,
  returnTo,
}: {
  mode: "register" | "sign-in";
  notice?: string;
  returnTo?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const router = useRouter();
  const requestInFlight = useRef(false);
  const feedback = useFormFeedback();
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

    const errors: Record<string, string> = {};

    if (registering && !name.trim()) {
      errors.name = "Enter your name.";
    }

    if (!z.email().safeParse(email.trim()).success) {
      errors.email = "Enter a valid email address.";
    }

    if (password.length < 10 || password.length > 128) {
      errors.password = "Use 10–128 characters.";
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
            email: result.error.message ?? "Enter a valid email address.",
          });
        } else if (
          ["PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG"].includes(
            result.error.code ?? "",
          )
        ) {
          feedback.setErrors({
            password: result.error.message ?? "Use 10–128 characters.",
          });
        } else {
          feedback.setMessage(
            !registering && result.error.code === "INVALID_EMAIL_OR_PASSWORD"
              ? "Invalid email or password. Please try again."
              : (result.error.message ??
                  "Unable to complete the request. Please try again."),
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
        feedback.setMessage("Unable to connect. Please try again.");
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
      <BackLink href="/">Back to home</BackLink>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="h4" component="h1">
              {registering ? "Create your account" : "Welcome back"}
            </Typography>
            <Typography color="text.secondary">
              {registering
                ? safeReturnTo
                  ? "Create your Event Flow account to continue."
                  : "Create your Event Flow account."
                : safeReturnTo
                  ? "Sign in to continue to your event."
                  : "Sign in to your Event Flow account."}
            </Typography>
          </Stack>
          {notice && <Alert severity="info">{notice}</Alert>}
          <Stack
            component="form"
            noValidate
            spacing={2.5}
            onSubmit={submit}
            aria-busy={pending}
          >
            {registering && (
              <TextField
                label="Name"
                value={name}
                disabled={pending}
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
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                feedback.clear("email");
              }}
              disabled={pending}
              {...feedback.field("email")}
              autoComplete="email"
              required
              fullWidth
            />
            <TextField
              label="Password"
              value={password}
              disabled={pending}
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
                          showPassword ? "Hide password" : "Show password"
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
                feedback.errors.password ??
                (registering ? "Use 10–128 characters." : undefined)
              }
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
              disabled={
                !email.trim() || !password || (registering && !name.trim())
              }
            >
              {pending
                ? "Please wait…"
                : registering
                  ? "Create account"
                  : "Sign in"}
            </Button>
            {registering && (
              <Typography variant="body2" color="text.secondary">
                We’ll send a verification link to your email before you can
                start.
              </Typography>
            )}
          </Stack>
          <Divider />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center" }}
          >
            {registering ? "Already have an account? " : "New to Event Flow? "}
            <Link href={registering ? signInHref : registerHref}>
              {registering ? "Sign in" : "Create account"}
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
