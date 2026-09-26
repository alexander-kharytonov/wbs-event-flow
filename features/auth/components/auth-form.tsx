"use client";

import {
  Alert,
  Button,
  Divider,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  rememberVerificationEmail,
  verificationCallbackURL,
  verificationPath,
} from "@/features/auth/verification-flow";
import { useNotifications } from "@/hooks/use-notifications";
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
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const router = useRouter();
  const requestInFlight = useRef(false);
  const notifications = useNotifications();
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

    requestInFlight.current = true;
    const form = new FormData(event.currentTarget);
    setPending(true);
    notifications.close("authentication");

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

        notifications.show(
          "Unable to complete the request. Check your details and try again.",
          {
            severity: "error",
            key: "authentication",
          },
        );

        return;
      }

      if (registering) {
        showVerification(credentials.email);
      }
    } catch {
      if (registering) {
        showVerification(String(form.get("email")), true);
      } else {
        notifications.show("Unable to connect. Please try again.", {
          severity: "error",
          key: "authentication",
        });
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
      <Link href="/" sx={{ alignSelf: "flex-start" }}>
        Back to home
      </Link>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 2 }}>
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
            spacing={2.5}
            onSubmit={submit}
            aria-busy={pending}
          >
            {registering && (
              <TextField
                label="Name"
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
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              fullWidth
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete={registering ? "new-password" : "current-password"}
              slotProps={{ htmlInput: { minLength: 10, maxLength: 128 } }}
              helperText={registering ? "Use 10–128 characters." : undefined}
              required
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={pending}>
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
