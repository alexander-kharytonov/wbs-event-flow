"use client";

import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ButtonBaseActions } from "@mui/material/ButtonBase";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import {
  previewMessage,
  queueMessage,
} from "@/features/communications/actions";
import { manualAudiences } from "@/features/communications/audiences";
import type { ManualAudience } from "@/features/communications/server/contracts";
import type { Messages } from "@/lib/i18n/messages";

type AttemptedSend = Readonly<{
  eventId: string;
  audience: ManualAudience;
  subject: string;
  message: string;
  requestKey: string;
}>;

type Preview = {
  audience: ManualAudience;
  recipientCount: number;
  unavailableCount: number;
};

export function RefreshCommunicationHistory() {
  const t = useTranslations("events");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="contained"
      startIcon={<RefreshOutlined />}
      disableTouchRipple
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? t("commRefreshing") : t("commRefresh")}
    </Button>
  );
}

// Pointer ripples in MUI 9.4 can loop when pending state disables the focused
// button. These local buttons disable touch ripples; keyboard focus stays styled.
export function ComposeMessage({
  eventId,
  disabledReason,
  onViewHistory,
}: {
  eventId: string;
  disabledReason?: keyof Messages["events"];
  onViewHistory: () => void;
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const [audience, setAudience] = useState<ManualAudience>(
    "ALL_ACTIVE_ATTENDEES",
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<keyof Messages["events"] | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, keyof Messages["events"]>
  >({});
  const [success, setSuccess] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [ambiguous, setAmbiguous] = useState(false);
  const [startingNew, setStartingNew] = useState(false);
  const [pending, startTransition] = useTransition();
  const attemptedSend = useRef<AttemptedSend | null>(null);
  const reviewButton = useRef<ButtonBaseActions | null>(null);
  const busy = useRef(false);
  const selected = manualAudiences.find((option) => option.value === audience);
  const locked = pending || ambiguous || Boolean(disabledReason);

  function edited(field: string) {
    attemptedSend.current = null;
    setError(null);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];

      return next;
    });
    setSuccess(null);
  }

  function reset() {
    attemptedSend.current = null;
    setAudience("ALL_ACTIVE_ATTENDEES");
    setSubject("");
    setMessage("");
    setPreview(null);
    setError(null);
    setFieldErrors({});
    setAmbiguous(false);
    setStartingNew(false);
    setConfirming(false);
  }

  function review(openDialog: boolean) {
    if (
      busy.current ||
      ambiguous ||
      disabledReason ||
      (openDialog && (!subject.trim() || !message.trim()))
    ) {
      return;
    }

    const errors: Record<string, keyof Messages["events"]> = {};

    if (openDialog) {
      if (
        !subject.isWellFormed() ||
        [...subject].length < 1 ||
        [...subject].length > 200 ||
        /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(subject)
      ) {
        errors.subject = "commSubjectInvalid";
      }

      const normalized = message.replace(/\r\n/g, "\n");

      if (
        !normalized.isWellFormed() ||
        [...normalized].length < 1 ||
        [...normalized].length > 10_000 ||
        /\p{Cc}/u.test(normalized.replace(/[\n\t]/g, "")) ||
        /[\u202a-\u202e\u2066-\u2069\ufeff]/u.test(normalized)
      ) {
        errors.message = "commMessageInvalid";
      }
    }

    if (openDialog) {
      setFieldErrors(errors);
    }

    if (Object.keys(errors).length) {
      return;
    }

    busy.current = true;
    setError(null);
    startTransition(async () => {
      try {
        // Always refresh before confirmation; no stale estimate is reused.
        const result = await previewMessage({ eventId, audience });

        if (!result.success) {
          setPreview(null);
          setError(result.error || "commEstimateFailed");

          return;
        }

        setPreview(result);
        setConfirming(openDialog);
      } catch {
        setError("commEstimateFailed");
      } finally {
        busy.current = false;
      }
    });
  }

  function send() {
    if (
      busy.current ||
      !confirming ||
      (ambiguous ? !attemptedSend.current : !preview)
    ) {
      return;
    }

    busy.current = true;
    attemptedSend.current ??= Object.freeze({
      eventId,
      audience,
      subject,
      message,
      requestKey: crypto.randomUUID(),
    });
    const input = attemptedSend.current;

    startTransition(async () => {
      try {
        const result = await queueMessage(input);

        // An unusable response cannot establish whether the send committed.
        if (
          (result.success !== true && result.success !== false) ||
          (result.success &&
            (!Number.isSafeInteger(result.recipientCount) ||
              result.recipientCount < 1)) ||
          (!result.success &&
            (typeof result.error !== "string" || !result.error))
        ) {
          throw new Error("Unexpected send response");
        }

        if (!result.success) {
          setError(result.error);
          setFieldErrors(result.fieldErrors ?? {});
          setAmbiguous((previous) => previous || Boolean(result.ambiguous));
          setConfirming(false);

          return;
        }

        reset();
        setSuccess(result.recipientCount);
        router.replace(`/dashboard/events/${eventId}/communications`);
        router.refresh();
      } catch {
        setAmbiguous(true);
        setConfirming(false);
        setError("commInterrupted");
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <>
      <Stack spacing={2.5}>
        {disabledReason && (
          <Alert severity="info">
            {t(disabledReason)}
            {t("commHistoryAvailable")}
          </Alert>
        )}
        {success !== null && (
          <Alert
            severity="success"
            action={
              <Button
                disableTouchRipple
                color="inherit"
                size="small"
                onClick={onViewHistory}
              >
                {t("commViewHistory")}
              </Button>
            }
          >
            {t("commQueued", { count: success })}
          </Alert>
        )}
        {ambiguous && (
          <Alert severity="warning">{t("commAmbiguousHint")}</Alert>
        )}
        <TextField
          select
          label={t("commAudience")}
          value={audience}
          disabled={locked}
          error={Boolean(fieldErrors.audience)}
          helperText={
            fieldErrors.audience
              ? t(fieldErrors.audience)
              : selected
                ? t(selected.description)
                : undefined
          }
          onChange={(event) => {
            edited("audience");
            setAudience(event.target.value as ManualAudience);
            setPreview(null);
          }}
        >
          {manualAudiences.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {t(option.label)}
            </MenuItem>
          ))}
        </TextField>
        <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{
                gap: 1,
                justifyContent: "space-between",
                alignItems: { sm: "center" },
              }}
            >
              <Stack spacing={0.5} aria-live="polite">
                <Typography variant="subtitle2">{t("commEstimate")}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {preview
                    ? t("commEstimated", { count: preview.recipientCount })
                    : t("commUpdateHint")}
                </Typography>
              </Stack>
              <Button
                disableTouchRipple
                variant="outlined"
                disabled={locked}
                onClick={() => review(false)}
                sx={{
                  alignSelf: { xs: "flex-start", sm: "center" },
                  flexShrink: 0,
                }}
              >
                {t("commUpdateEstimate")}
              </Button>
            </Stack>
            <Alert severity="info">
              {t("commUniqueEmails")}
              {Boolean(preview?.unavailableCount) &&
                t("commMissingEmails", {
                  count: preview?.unavailableCount ?? 0,
                })}
            </Alert>
          </Stack>
        </Paper>
        <TextField
          label={t("commSubject")}
          required
          value={subject}
          disabled={locked}
          error={Boolean(fieldErrors.subject)}
          helperText={
            (fieldErrors.subject ? t(fieldErrors.subject) : undefined) ??
            t("commSubjectCount", { count: [...subject].length })
          }
          onChange={(event) => {
            edited("subject");
            setSubject(event.target.value);
          }}
        />
        <TextField
          label={t("commMessage")}
          required
          multiline
          minRows={6}
          maxRows={18}
          value={message}
          disabled={locked}
          error={Boolean(fieldErrors.message)}
          helperText={
            (fieldErrors.message ? t(fieldErrors.message) : undefined) ??
            t("commMessageCount", {
              count: [...message.replace(/\r\n/g, "\n")].length,
            })
          }
          onChange={(event) => {
            edited("message");
            setMessage(event.target.value);
          }}
        />
        {error && <Alert severity="error">{t(error)}</Alert>}
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button
            disableTouchRipple
            action={reviewButton}
            variant="contained"
            startIcon={<SendOutlined />}
            disabled={
              pending ||
              Boolean(disabledReason) ||
              (!ambiguous && (!subject.trim() || !message.trim()))
            }
            onClick={() => {
              if (ambiguous && attemptedSend.current) {
                setConfirming(true);
              } else {
                review(true);
              }
            }}
          >
            {pending
              ? t("commWait")
              : ambiguous
                ? t("commRetry")
                : t("commReview")}
          </Button>
          {ambiguous && (
            <Button
              disableTouchRipple
              disabled={pending}
              onClick={() => setStartingNew(true)}
            >
              {t("commStartNew")}
            </Button>
          )}
        </Stack>
      </Stack>
      <Dialog
        open={confirming}
        onClose={() => {
          if (!pending) setConfirming(false);
        }}
        disableRestoreFocus
        slotProps={{
          transition: {
            onExited: () => reviewButton.current?.focusVisible(),
          },
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="queue-message-title"
      >
        <DialogTitle id="queue-message-title">
          {ambiguous ? t("commRetryTitle") : t("commQueueTitle")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              <strong>{t("commAudience")}:</strong>{" "}
              {selected && t(selected.label)}
            </Typography>
            <Typography sx={{ overflowWrap: "anywhere" }}>
              <strong>{t("commSubject")}:</strong> {subject}
            </Typography>
            {!ambiguous && (
              <Typography>
                {t("commEstimated", { count: preview?.recipientCount ?? 0 })}
              </Typography>
            )}
            <Alert severity={ambiguous ? "warning" : "info"}>
              {ambiguous ? t("commRetryHint") : t("commQueueHint")}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disableTouchRipple
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            disableTouchRipple
            variant="contained"
            disabled={pending}
            onClick={send}
          >
            {ambiguous ? t("commRetry") : t("commQueue")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={startingNew}
        onClose={() => setStartingNew(false)}
        aria-labelledby="new-message-title"
      >
        <DialogTitle id="new-message-title">
          {t("commStartNewTitle")}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning">{t("commNewWarning")}</Alert>
        </DialogContent>
        <DialogActions>
          <Button disableTouchRipple onClick={() => setStartingNew(false)}>
            {t("cancel")}
          </Button>
          <Button disableTouchRipple onClick={reset}>
            {t("commStartNew")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
