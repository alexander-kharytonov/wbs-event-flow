"use client";

import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useFormFeedback } from "@/hooks/use-form-feedback";

export type EditableCover = { assetId: string | null; alt: string | null };

export function EventCoverEditor({
  eventId,
  initial,
  version,
  disabled,
  begin,
  end,
  onSaved,
}: {
  eventId: string;
  initial: EditableCover;
  version: string;
  disabled: boolean;
  begin: () => boolean;
  end: () => void;
  onSaved: (version: string) => void;
}) {
  const [cover, setCover] = useState(initial);
  const [assetId, setAssetId] = useState(initial.assetId);
  const [alt, setAlt] = useState(initial.alt ?? "");
  const [file, setFile] = useState<File>();
  const [pending, setPending] = useState<"upload" | "save" | null>(null);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [failedAssetId, setFailedAssetId] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const feedback = useFormFeedback();
  useEffect(() => () => request.current?.abort(), []);

  async function mutate(kind: "upload" | "save", remove = false) {
    if (disabled || pending || (kind === "upload" && !file)) {
      return;
    }
    feedback.reset();
    setSaved(false);

    if (kind === "save" && !remove && alt.trim().length > 500) {
      feedback.setErrors({ alt: "Use at most 500 characters." });

      return;
    }

    if (!begin()) {
      return;
    }
    setPending(kind);
    const controller = new AbortController();
    request.current = controller;

    try {
      const response = await fetch(
        `/api/events/${eventId}/cover${kind === "upload" ? "/uploads" : ""}`,
        {
          method: kind === "upload" ? "POST" : "PUT",
          headers: {
            "Content-Type":
              kind === "upload" ? (file?.type ?? "") : "application/json",
          },
          body:
            kind === "upload"
              ? file
              : JSON.stringify({
                  assetId: remove ? null : assetId,
                  alt: remove || !assetId ? null : alt.trim() || null,
                  version,
                }),
          signal: controller.signal,
        },
      );
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setConflict(true);
        }
        feedback.setMessage(
          typeof result.message === "string"
            ? result.message
            : "Could not save this cover.",
        );

        return;
      }

      if (kind === "upload") {
        setAssetId(result.assetId);
        setFile(undefined);
      } else {
        const next = {
          assetId: remove ? null : assetId,
          alt: remove ? null : alt.trim() || null,
        };
        setCover(next);
        setAssetId(next.assetId);
        setAlt(next.alt ?? "");
        setFile(undefined);
        onSaved(result.version);
        setSaved(true);
        setConflict(false);
      }
    } catch {
      if (!controller.signal.aborted) {
        feedback.setMessage(
          "Could not confirm the operation. Reload the event before retrying a cover save.",
        );
      }
    } finally {
      setPending(null);
      end();
    }
  }

  return (
    <Stack
      component="section"
      spacing={2}
      aria-label="Event cover"
      aria-busy={Boolean(pending)}
    >
      <Typography variant="h6" component="h2">
        Cover image
      </Typography>
      <Typography variant="body2" color="text.secondary">
        JPEG, PNG or WebP, up to 5 MiB and 4096 × 4096. Upload, review the
        normalized preview, then save the cover. Only Republish updates the
        published cover.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button
          type="button"
          variant="outlined"
          disabled={disabled || Boolean(pending)}
          onClick={() => fileInput.current?.click()}
        >
          {cover.assetId ? "Choose replacement" : "Choose image"}
        </Button>
        <input
          ref={fileInput}
          hidden
          type="file"
          aria-label="Cover image file"
          disabled={disabled || Boolean(pending)}
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            setFile(event.target.files?.[0]);
            event.target.value = "";
            feedback.clear("file");
            setSaved(false);
          }}
        />
        <Button
          type="button"
          disabled={!file || disabled || Boolean(pending)}
          onClick={() => void mutate("upload")}
        >
          Upload
        </Button>
      </Stack>
      {file && (
        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
          Selected: {file.name}
        </Typography>
      )}
      {pending && (
        <Box role="status" aria-live="polite">
          <Typography variant="body2">
            {pending === "upload"
              ? "Uploading and processing image…"
              : "Saving cover…"}
          </Typography>
          <LinearProgress />
        </Box>
      )}
      {assetId && (
        <>
          <Box
            sx={{
              width: "100%",
              height: { xs: 220, sm: 280 },
              display: "grid",
              placeItems: "center",
              bgcolor: "action.hover",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            {failedAssetId === assetId ? (
              <Typography
                role="status"
                variant="body2"
                color="text.secondary"
                sx={{ p: 2 }}
              >
                Cover image unavailable. Choose another image to replace it.
              </Typography>
            ) : (
              <Box
                component="img"
                src={`/api/events/${eventId}/cover/${assetId}/640`}
                alt={alt || "Cover preview"}
                onError={() => setFailedAssetId(assetId)}
                ref={(element: HTMLImageElement | null) => {
                  if (element?.complete && element.naturalWidth === 0) {
                    setFailedAssetId(assetId);
                  }
                }}
                sx={{
                  width: "100%",
                  height: "100%",
                  minHeight: 0,
                  objectFit: "contain",
                }}
              />
            )}
          </Box>
          <TextField
            label="Cover alternative text"
            value={alt}
            onChange={(event) => {
              setAlt(event.target.value);
              feedback.clear("alt");
              setSaved(false);
            }}
            {...feedback.field("alt")}
            helperText={
              feedback.errors.alt ??
              "Describe the image for people using a screen reader. Leave blank for a decorative image."
            }
            disabled={disabled || Boolean(pending)}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
        </>
      )}
      {feedback.message && <Alert severity="error">{feedback.message}</Alert>}
      {conflict && (
        <Alert severity="error">
          The event may have changed.{" "}
          <Button
            component="a"
            href={`/dashboard/events/${eventId}/edit`}
            color="inherit"
          >
            Reload latest version
          </Button>
        </Alert>
      )}
      {saved && (
        <Alert severity="success" role="status">
          Cover saved. Other event changes are not saved yet.
        </Alert>
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button
          type="button"
          variant="outlined"
          disabled={
            !assetId ||
            Boolean(file) ||
            disabled ||
            Boolean(pending) ||
            conflict
          }
          onClick={() => void mutate("save")}
        >
          Save cover
        </Button>
        {cover.assetId && (
          <Button
            type="button"
            color="error"
            disabled={disabled || Boolean(pending) || conflict}
            onClick={() => void mutate("save", true)}
          >
            Remove cover
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
