"use client";

import LockOutlined from "@mui/icons-material/LockOutlined";
import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

export function EventPasswordGate({
  publicId,
  registration,
}: {
  publicId: string;
  registration: boolean;
}) {
  const t = useTranslations("events");
  const input = useRef<HTMLInputElement>(null);
  const [filled, setFilled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  return (
    <Paper
      variant="outlined"
      sx={{ p: { xs: 3, sm: 4 }, maxWidth: 480, width: "100%", mx: "auto" }}
    >
      <Stack
        component="form"
        noValidate
        spacing={2}
        onSubmit={async (event) => {
          event.preventDefault();

          if (pending || !input.current?.value) return;
          setPending(true);
          setError(false);

          try {
            const response = await fetch(`/e/${publicId}/access`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input.current.value),
            });
            input.current.value = "";
            setFilled(false);

            if (response.ok) {
              // A fresh document discards any pre-verification RSC/router cache.
              window.location.replace(
                `/e/${publicId}${registration ? "/register" : ""}`,
              );

              return;
            }
            setError(true);
          } catch {
            setError(true);
          } finally {
            if (input.current) input.current.value = "";
            setFilled(false);
            setPending(false);
          }
        }}
      >
        <LockOutlined color="primary" />
        <Typography variant="h5" component="h1">
          {t("accessLockedTitle")}
        </Typography>
        <Typography color="text.secondary">{t("accessLockedHint")}</Typography>
        <TextField
          inputRef={input}
          type="password"
          label={t("accessPassword")}
          autoComplete="current-password"
          required
          disabled={pending}
          error={error}
          onChange={(event) => {
            setFilled(Boolean(event.target.value));
            setError(false);
          }}
        />
        {error && <Alert severity="error">{t("accessUnavailable")}</Alert>}
        <Button type="submit" variant="contained" disabled={!filled || pending}>
          {t(pending ? "accessVerifying" : "accessUnlock")}
        </Button>
      </Stack>
    </Paper>
  );
}
