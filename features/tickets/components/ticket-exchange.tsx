"use client";

import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

export function TicketExchange() {
  const t = useTranslations("events");
  const started = useRef(false);
  const attempt = useRef(0);
  const [failed, setFailed] = useState(false);
  const exchange = useCallback(async () => {
    const currentAttempt = ++attempt.current;
    const capability = window.location.hash.slice(1);
    setFailed(false);

    try {
      if (!/^[A-Za-z0-9_-]{43}$/.test(capability)) {
        setFailed(true);

        return;
      }

      const response = await fetch("/ticket/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(capability),
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json();

      if (
        currentAttempt !== attempt.current ||
        window.location.hash.slice(1) !== capability
      ) {
        return;
      }

      if (
        !response.ok ||
        typeof result.path !== "string" ||
        !/^\/ticket\/view\/[0-9a-f-]{36}$/.test(result.path)
      ) {
        setFailed(true);

        return;
      }

      window.history.replaceState(null, "", "/ticket");
      window.location.replace(result.path);
    } catch {
      if (currentAttempt === attempt.current) {
        setFailed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void exchange();
    }

    const onHashChange = () => void exchange();
    window.addEventListener("hashchange", onHashChange);

    return () => window.removeEventListener("hashchange", onHashChange);
  }, [exchange]);

  return (
    <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
      <Typography variant="h4">{t("yourTicket")}</Typography>
      {failed ? (
        <>
          <Alert severity="info">{t("ticketSessionUnavailable")}</Alert>
          <Button onClick={() => void exchange()}>
            {t("ticketExchangeRetry")}
          </Button>
        </>
      ) : (
        <CircularProgress aria-label={t("ticketOpening")} />
      )}
      <noscript>{t("ticketJavascriptRequired")}</noscript>
    </Stack>
  );
}
