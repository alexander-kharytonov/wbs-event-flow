"use client";

import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/ui/empty-state";
import { EventText } from "@/features/events/components/event-text";
import type { GuestResult } from "@/features/guests/guest-result";
import type { PartyGuestsPresentation } from "@/features/guests/server/party-presentation";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import type { Messages } from "@/lib/i18n/messages";

const messages: Record<GuestResult["code"], keyof Messages["events"]> = {
  ADDED: "guestAdded",
  REMOVED: "guestRemoved",
  ALREADY_REMOVED: "guestAlreadyRemoved",
  UNAVAILABLE: "guestUnavailable",
  GUEST_LIMIT_REACHED: "guestLimitReached",
  CAPACITY_REACHED: "guestEventFull",
  GUESTS_NOT_ALLOWED: "guestsNotAllowed",
  NOT_PUBLISHED: "guestsNotPublished",
  PARTY_FROZEN: "guestsFrozen",
  EVENT_CANCELLED: "eventCancelledMessage",
  REGISTRATION_REVOKED: "registrationRevokedMessage",
  INVALID_INPUT: "guestInputInvalid",
  FAILED: "guestUpdateFailed",
};

export function PartyGuestsControls({
  party,
  cards,
  addAction,
  removeAction,
}: {
  party: Omit<PartyGuestsPresentation, "items"> & {
    items: { id: string; active: boolean }[];
  };
  cards: ReactNode[];
  addAction: (input: { name: string; email: string }) => Promise<GuestResult>;
  removeAction: (guestId: string) => Promise<GuestResult>;
}) {
  const t = useTranslations("events");
  const notifications = useNotifications();
  const feedback = useFormFeedback<keyof Messages["events"]>({}, t);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(operation: () => Promise<GuestResult>) {
    startTransition(async () => {
      try {
        const next = await operation();

        if (["ADDED", "REMOVED", "ALREADY_REMOVED"].includes(next.code)) {
          setOpen(false);
          setRemoveId(null);
          notifications.show(<EventText id={messages[next.code]} />, {
            severity: "success",
            autoHideDuration: 5000,
          });

          return;
        }

        feedback.setErrors(next.fieldErrors ?? {});
        feedback.setMessage(messages[next.code] ?? messages.FAILED);
      } catch {
        feedback.setMessage(messages.FAILED);
      }
    });
  }

  return (
    <Stack component="section" spacing={2}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}
      >
        <Box>
          <Typography variant="h6" component="h2">
            {t("guests")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("activeGuestCount", {
              count: party.activeCount,
              limit: party.limit,
            })}
          </Typography>
        </Box>
        {party.canAdd && (
          <Button
            variant="outlined"
            onClick={() => {
              feedback.reset();
              setName("");
              setEmail("");
              setOpen(true);
            }}
          >
            {t("addGuest")}
          </Button>
        )}
      </Stack>
      {party.reason && <Alert severity="info">{t(party.reason)}</Alert>}
      {party.items.length === 0 && (
        <EmptyState
          icon={<PeopleOutlined />}
          title={t("noGuests")}
          description={t("guestsEmptyDescription")}
        />
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        {party.items.map((guest, index) => (
          <Box
            key={guest.id}
            sx={{
              display: "grid",
              gridTemplateRows: "subgrid",
              gridRow: "span 2",
              rowGap: 1,
              minWidth: 0,
            }}
          >
            {cards[index]}
            <Box>
              {guest.active && party.canRemove && (
                <Button
                  fullWidth
                  color="error"
                  onClick={() => {
                    feedback.reset();
                    setRemoveId(guest.id);
                  }}
                >
                  {t("removeGuest")}
                </Button>
              )}
            </Box>
          </Box>
        ))}
      </Box>
      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        fullWidth
        maxWidth="xs"
      >
        <Box
          component="form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            feedback.reset();
            const errors: Record<string, keyof Messages["events"]> = {};

            if (!name.trim() || name.trim().length > 200) {
              errors.name = "nameLength";
            }

            if (email.trim() && !z.email().safeParse(email.trim()).success) {
              errors.email = "invalidEmail";
            }
            feedback.setErrors(errors);

            if (!pending && !Object.keys(errors).length) {
              submit(() => addAction({ name, email }));
            }
          }}
        >
          <DialogTitle>{t("addGuest")}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                name="name"
                label={t("guestName")}
                value={name}
                disabled={pending}
                {...feedback.field("name")}
                onChange={(event) => {
                  setName(event.target.value);
                  feedback.clear("name");
                }}
                required
                autoFocus
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <TextField
                name="email"
                label={t("emailOptional")}
                type="email"
                value={email}
                disabled={pending}
                {...feedback.field("email")}
                onChange={(event) => {
                  setEmail(event.target.value);
                  feedback.clear("email");
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {t("guestCapacityHint")}
              </Typography>
            </Stack>
          </DialogContent>
          {feedback.message && (
            <Alert severity="error" sx={{ mx: 3 }}>
              {feedback.message}
            </Alert>
          )}
          <DialogActions>
            <Button disabled={pending} onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={pending || !name.trim()}
            >
              {pending ? t("adding") : t("addGuest")}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog
        open={removeId !== null}
        onClose={() => {
          if (!pending) setRemoveId(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t("removeGuestTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>{t("removeGuestDescription")}</Typography>
          </Stack>
        </DialogContent>
        {feedback.message && (
          <Alert severity="error" sx={{ mx: 3 }}>
            {feedback.message}
          </Alert>
        )}
        <DialogActions>
          <Button disabled={pending} onClick={() => setRemoveId(null)}>
            {t("cancel")}
          </Button>
          <Button
            color="error"
            disabled={pending}
            onClick={() => {
              if (removeId) submit(() => removeAction(removeId));
            }}
          >
            {t("removeGuest")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
