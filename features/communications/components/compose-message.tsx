"use client";

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
import { useRef, useState, useTransition } from "react";
import {
  previewMessage,
  queueMessage,
} from "@/features/communications/actions";
import { manualAudiences } from "@/features/communications/audiences";
import type { ManualAudience } from "@/features/communications/server/contracts";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disableTouchRipple
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Refreshing…" : "Refresh History"}
    </Button>
  );
}

// Pointer ripples in MUI 9.4 can loop when pending state disables the focused
// button. These local buttons disable touch ripples; keyboard focus stays styled.
export function ComposeMessage({
  eventId,
  disabledReason,
}: {
  eventId: string;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState<ManualAudience>(
    "ALL_ACTIVE_ATTENDEES",
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

    const errors: Record<string, string> = {};

    if (openDialog) {
      if (
        !subject.isWellFormed() ||
        [...subject].length < 1 ||
        [...subject].length > 200 ||
        /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(subject)
      ) {
        errors.subject =
          "Use 1–200 Unicode characters on one line, without control characters.";
      }

      const normalized = message.replace(/\r\n/g, "\n");

      if (
        !normalized.isWellFormed() ||
        [...normalized].length < 1 ||
        [...normalized].length > 10_000 ||
        /\p{Cc}/u.test(normalized.replace(/[\n\t]/g, "")) ||
        /[\u202a-\u202e\u2066-\u2069\ufeff]/u.test(normalized)
      ) {
        errors.message =
          "Use 1–10,000 Unicode characters without unsafe control characters.";
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
          setError(result.error);

          return;
        }

        setPreview(result);
        setConfirming(openDialog);
      } catch {
        setError("Couldn’t refresh the recipient estimate. Please try again.");
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

        if (!result.success) {
          setError(
            result.fieldErrors && Object.keys(result.fieldErrors).length
              ? null
              : result.error,
          );
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
        setError(
          "The response was interrupted. This message may already be queued. Retry the same send to recover or complete the original request.",
        );
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Typography variant="h6" component="h2">
          New message
        </Typography>
        {disabledReason && (
          <Alert severity="info">
            {disabledReason} History remains available.
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
                href="#communication-history"
              >
                View History
              </Button>
            }
          >
            Queued for {success} recipients
          </Alert>
        )}
        {ambiguous && (
          <Alert severity="warning">
            Keep this page open. Retry same send uses the original message and
            request key. It may complete the original send if it was not queued.
            Starting a new message could send another copy if it succeeded.
          </Alert>
        )}
        <TextField
          select
          label="Audience"
          value={audience}
          disabled={locked}
          error={Boolean(fieldErrors.audience)}
          helperText={fieldErrors.audience ?? selected?.description}
          onChange={(event) => {
            edited("audience");
            setAudience(event.target.value as ManualAudience);
            setPreview(null);
          }}
        >
          {manualAudiences.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
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
                <Typography variant="subtitle2">Recipient estimate</Typography>
                <Typography variant="body2" color="text.secondary">
                  {preview
                    ? `Estimated recipients: ${preview.recipientCount}`
                    : "Update the estimate to see the number of recipients."}
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
                Update recipient estimate
              </Button>
            </Stack>
            <Alert severity="info">
              Unique deliverable email addresses. The actual number may change
              before Send.
              {Boolean(preview?.unavailableCount) && (
                <> Missing or invalid email: {preview?.unavailableCount}.</>
              )}
            </Alert>
          </Stack>
        </Paper>
        <TextField
          label="Subject"
          required
          value={subject}
          disabled={locked}
          error={Boolean(fieldErrors.subject)}
          helperText={
            fieldErrors.subject ??
            `${[...subject].length}/200 Unicode characters`
          }
          onChange={(event) => {
            edited("subject");
            setSubject(event.target.value);
          }}
        />
        <TextField
          label="Message"
          required
          multiline
          minRows={6}
          maxRows={18}
          value={message}
          disabled={locked}
          error={Boolean(fieldErrors.message)}
          helperText={
            fieldErrors.message ??
            `Plain text · ${[...message.replace(/\r\n/g, "\n")].length}/10,000 Unicode characters`
          }
          onChange={(event) => {
            edited("message");
            setMessage(event.target.value);
          }}
        />
        {error && <Alert severity="error">{error}</Alert>}
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
              ? "Please wait…"
              : ambiguous
                ? "Retry same send"
                : "Review message"}
          </Button>
          {ambiguous && (
            <Button
              disableTouchRipple
              disabled={pending}
              onClick={() => setStartingNew(true)}
            >
              Start a new message
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
          {ambiguous ? "Retry the original send?" : "Queue this message?"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              <strong>Audience:</strong> {selected?.label}
            </Typography>
            <Typography sx={{ overflowWrap: "anywhere" }}>
              <strong>Subject:</strong> {subject}
            </Typography>
            {!ambiguous && (
              <Typography>
                Estimated recipients: {preview?.recipientCount}
              </Typography>
            )}
            <Alert severity={ambiguous ? "warning" : "info"}>
              {ambiguous
                ? "This repeats the original request with the same message and key. If it was already queued, you will recover its result. If it was not queued, retry may complete the original send using the current audience and sending limits. No new recipient estimate is requested."
                : "Send uses the current audience and freezes the recipients when the message is queued. The actual count may differ from this estimate."}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disableTouchRipple
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
          <Button
            disableTouchRipple
            variant="contained"
            disabled={pending}
            onClick={send}
          >
            {ambiguous ? "Retry same send" : "Queue message"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={startingNew}
        onClose={() => setStartingNew(false)}
        aria-labelledby="new-message-title"
      >
        <DialogTitle id="new-message-title">Start a new message?</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            The previous message may already be queued. This clears the compose
            fields and abandons its retry key. Check History before sending
            another copy.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button disableTouchRipple onClick={() => setStartingNew(false)}>
            Cancel
          </Button>
          <Button disableTouchRipple onClick={reset}>
            Start a new message
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
