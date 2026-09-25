"use client";

import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import { useState, useTransition } from "react";
import { publicationState } from "@/features/events/publication-state";
import { publishEvent } from "@/features/events/publish-event-action";
import type { PublishResult } from "@/features/events/server/publish-event";

export function PublicationControls({
  eventId,
  contentVersion,
  publishedRevision,
}: {
  eventId: string;
  contentVersion: number;
  publishedRevision: { contentVersion: number; number?: number } | null;
}) {
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
            disabled={pending || result.conflict}
            onClick={() => {
              startTransition(async () => {
                try {
                  setResult(await publishEvent({ eventId, contentVersion }));
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
      {result.message && (
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
