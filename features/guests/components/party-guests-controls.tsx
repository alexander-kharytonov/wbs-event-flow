"use client";

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
import { type ReactNode, useState, useTransition } from "react";
import type { GuestResult } from "@/features/guests/guest-result";
import type { PartyGuestsPresentation } from "@/features/guests/server/party-presentation";
import { useNotifications } from "@/hooks/use-notifications";

const messages: Record<GuestResult["code"], string> = {
  ADDED: "Guest added.",
  REMOVED: "Guest removed.",
  ALREADY_REMOVED: "This guest has already been removed.",
  UNAVAILABLE: "This guest request is unavailable.",
  GUEST_LIMIT_REACHED: "The published guest limit has been reached.",
  CAPACITY_REACHED: "The event is full. No guest was added.",
  GUESTS_NOT_ALLOWED: "Guests are not currently allowed.",
  NOT_PUBLISHED:
    "This event is not currently published. Guests cannot be added.",
  PARTY_FROZEN: "Guest management closed when the event started.",
  EVENT_CANCELLED: "This event has been cancelled.",
  REGISTRATION_REVOKED: "This registration has been revoked.",
  INVALID_INPUT:
    "Enter a name of 1–200 characters and a valid email, or leave email empty.",
  FAILED: "Could not update your guests. Please try again.",
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
  const notifications = useNotifications();
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
          notifications.show(messages[next.code], {
            severity: "success",
            autoHideDuration: 5000,
          });

          return;
        }

        notifications.show(messages[next.code], {
          severity: "error",
          autoHideDuration: 5000,
        });
      } catch {
        notifications.show(messages.FAILED, {
          severity: "error",
          autoHideDuration: 5000,
        });
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
            Guests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {party.activeCount} active / {party.limit} published limit
          </Typography>
        </Box>
        {party.canAdd && (
          <Button
            variant="outlined"
            onClick={() => {
              setOpen(true);
            }}
          >
            Add guest
          </Button>
        )}
      </Stack>
      {party.reason && <Alert severity="info">{party.reason}</Alert>}
      {party.items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No guests added.
        </Typography>
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
                    setRemoveId(guest.id);
                  }}
                >
                  Remove guest
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
          action={(data) =>
            submit(() =>
              addAction({
                name: String(data.get("name") ?? ""),
                email: String(data.get("email") ?? ""),
              }),
            )
          }
        >
          <DialogTitle>Add guest</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                name="name"
                label="Guest name"
                required
                autoFocus
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <TextField name="email" label="Email (optional)" type="email" />
              <Typography variant="body2" color="text.secondary">
                Your guest counts toward event capacity. You can manage guests
                until the event starts.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={pending}>
              {pending ? "Adding…" : "Add guest"}
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
        <DialogTitle>Remove guest?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              The guest’s ticket will be revoked and their place released. Their
              history will be kept.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={pending} onClick={() => setRemoveId(null)}>
            Cancel
          </Button>
          <Button
            color="error"
            disabled={pending}
            onClick={() => {
              if (removeId) submit(() => removeAction(removeId));
            }}
          >
            Remove guest
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
