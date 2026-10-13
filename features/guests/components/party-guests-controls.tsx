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
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { EventText } from "@/features/events/components/event-text";
import type { GuestResult } from "@/features/guests/guest-result";
import type { PartyGuestsPresentation } from "@/features/guests/server/party-presentation";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import type { Messages } from "@/lib/i18n/messages";

const messages: Record<GuestResult["code"], keyof Messages["events"]> = {
  REMOVED: "guestRemoved",
  ALREADY_REMOVED: "guestAlreadyRemoved",
  UNAVAILABLE: "guestUnavailable",
  PARTY_FROZEN: "guestsFrozen",
  EVENT_CANCELLED: "eventCancelledMessage",
  REGISTRATION_REVOKED: "registrationRevokedMessage",
  FAILED: "guestUpdateFailed",
};

export function PartyGuestsControls({
  party,
  cards,
  removeAction,
}: {
  party: Omit<PartyGuestsPresentation, "items"> & {
    items: { id: string; active: boolean }[];
  };
  cards: ReactNode[];
  removeAction: (guestId: string) => Promise<GuestResult>;
}) {
  const t = useTranslations("events");
  const notifications = useNotifications();
  const feedback = useFormFeedback<keyof Messages["events"]>({}, t);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(operation: () => Promise<GuestResult>) {
    startTransition(async () => {
      try {
        const next = await operation();

        if (["REMOVED", "ALREADY_REMOVED"].includes(next.code)) {
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
            })}
          </Typography>
        </Box>
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
