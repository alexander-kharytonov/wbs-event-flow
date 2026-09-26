"use client";

import {
  Link as LinkIcon,
  OpenInNew as OpenInNewIcon,
} from "@mui/icons-material";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import { useState, useTransition } from "react";
import { publicationState } from "@/features/events/publication-state";
import { publishEvent } from "@/features/events/publish-event-action";
import type { PublishResult } from "@/features/events/server/publish-event";
import { useNotifications } from "@/hooks/use-notifications";

export function PublicationControls({
  eventId,
  contentVersion,
  publishedRevision,
  publicId,
}: {
  eventId: string;
  publicId: string | null;
  contentVersion: number;
  publishedRevision: { contentVersion: number; number?: number } | null;
}) {
  const notifications = useNotifications();
  const [result, setResult] = useState<PublishResult>({});
  const [pending, startTransition] = useTransition();
  const state = publicationState({ contentVersion, publishedRevision });

  return (
    <Stack spacing={1.5} aria-busy={pending}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
      >
        <Chip label={state} size="small" variant="outlined" />
        {publishedRevision?.number && (
          <Typography variant="body2" color="text.secondary">
            Revision {publishedRevision.number}
          </Typography>
        )}
        {state !== "Published" && (
          <Button
            variant="contained"
            color="success"
            disabled={pending || result.conflict}
            onClick={() => {
              notifications.close(`publish:${eventId}`);
              startTransition(async () => {
                try {
                  const outcome = await publishEvent({
                    eventId,
                    contentVersion,
                  });
                  setResult(outcome);

                  if (outcome.success) {
                    notifications.show("Event published.", {
                      severity: "success",
                      autoHideDuration: 4000,
                      key: `publish:${eventId}`,
                    });
                  } else if (outcome.message && !outcome.conflict) {
                    notifications.show(outcome.message, {
                      severity: "error",
                      key: `publish:${eventId}`,
                    });
                  }
                } catch {
                  setResult({
                    message:
                      "We couldn’t confirm publication. Reload the event to check its status.",
                    conflict: true,
                  });
                }
              });
            }}
          >
            {pending
              ? "Publishing…"
              : state === "Draft"
                ? "Publish"
                : "Publish changes"}
          </Button>
        )}
      </Stack>
      {publicId && publishedRevision && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button
            startIcon={<OpenInNewIcon />}
            href={`/e/${publicId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open public page
          </Button>
          <Button
            variant="outlined"
            startIcon={<LinkIcon />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  new URL(`/e/${publicId}`, window.location.origin).href,
                );
                notifications.show("Link copied.", {
                  severity: "success",
                  key: "copy-event-link",
                  autoHideDuration: 3000,
                });
              } catch {
                notifications.show(
                  "Couldn’t copy the link. Open the public page and copy its address.",
                  { severity: "error", key: "copy-event-link" },
                );
              }
            }}
          >
            Copy link
          </Button>
        </Stack>
      )}
      {result.message && result.conflict && (
        <Alert severity="error">
          {result.message}
          {result.conflict && (
            <Button href={`/dashboard/events/${eventId}`}>Reload event</Button>
          )}
        </Alert>
      )}
    </Stack>
  );
}
