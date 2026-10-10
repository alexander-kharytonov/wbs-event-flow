"use client";

import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CoverCropper,
  type CoverSource,
} from "@/features/events/components/cover-cropper";
import { initialCoverCrop } from "@/features/events/cover-crop";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";

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
  const [pending, setPending] = useState<"select" | "upload" | "save" | null>(
    null,
  );
  const [source, setSource] = useState<CoverSource | null>(null);
  const [crop, setCrop] = useState(initialCoverCrop);
  const selection = useRef(0);
  const notifications = useNotifications();
  const [conflict, setConflict] = useState(false);
  const [failedAssetId, setFailedAssetId] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const feedback = useFormFeedback();
  useEffect(
    () => () => {
      request.current?.abort();
      selection.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (source) {
        URL.revokeObjectURL(source.url);
      }
    },
    [source],
  );

  async function selectFile(next: File | undefined) {
    if (!next || disabled || pending) {
      return;
    }

    feedback.reset();

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(next.type) ||
      next.size > 5 * 1024 * 1024
    ) {
      feedback.setMessage("Choose a JPEG, PNG or WebP image up to 5 MiB.");

      return;
    }

    if (!begin()) {
      return;
    }

    const current = ++selection.current;
    setPending("select");

    try {
      const bitmap = await createImageBitmap(next, {
        imageOrientation: "from-image",
      });
      const { width, height } = bitmap;
      bitmap.close();

      if (current !== selection.current) {
        return;
      }

      if (width > 4096 || height > 4096 || width < 16 || height < 9) {
        feedback.setMessage(
          "Choose an image from 16 × 9 up to 4096 × 4096 pixels.",
        );

        return;
      }

      setSource({ url: URL.createObjectURL(next), width, height });
      setFile(next);
      setCrop(initialCoverCrop);
    } catch {
      if (current === selection.current) {
        feedback.setMessage(
          "This image could not be opened. Choose a valid JPEG, PNG or WebP.",
        );
      }
    } finally {
      if (current === selection.current) {
        setPending(null);
        end();
      }
    }
  }

  async function mutate(kind: "upload" | "save", remove = false) {
    if (disabled || pending || (kind === "upload" && !file)) {
      return;
    }
    feedback.reset();

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
            ...(kind === "upload"
              ? { "X-Event-Cover-Crop": JSON.stringify(crop) }
              : {}),
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
        setSource(null);
      } else {
        const next = {
          assetId: remove ? null : assetId,
          alt: remove ? null : alt.trim() || null,
        };
        setCover(next);
        setAssetId(next.assetId);
        setAlt(next.alt ?? "");
        setFile(undefined);
        setSource(null);
        onSaved(result.version);
        notifications.show(
          `${remove ? "Cover removed." : "Cover saved."} Other event changes are not saved yet.`,
          {
            severity: "success",
            autoHideDuration: 5000,
            key: `cover:${eventId}`,
          },
        );
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

  const busy = disabled || Boolean(pending);
  const changed =
    assetId !== cover.assetId || (alt.trim() || null) !== cover.alt;
  const chooseButton = (
    <Button
      type="button"
      variant="outlined"
      startIcon={<AddPhotoAlternateOutlined />}
      disabled={busy || conflict}
      onClick={() => fileInput.current?.click()}
    >
      {assetId || source ? "Choose another image" : "Choose image"}
    </Button>
  );

  return (
    <Stack
      component="section"
      spacing={2}
      aria-label="Event cover"
      aria-busy={Boolean(pending)}
      sx={{ pb: 3, borderBottom: 1, borderColor: "divider" }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
      >
        <Typography variant="h6" component="h2">
          Cover image
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          label={
            source
              ? "Adjust crop · 16:9"
              : assetId !== cover.assetId
                ? "Ready to save"
                : assetId
                  ? "Saved cover · 16:9"
                  : "16:9"
          }
        />
      </Stack>
      <Alert severity="info">
        Choose an image, adjust the crop, then upload and save your cover. JPEG,
        PNG or WebP, up to 5 MiB and 4096 × 4096 pixels.
      </Alert>
      <input
        ref={fileInput}
        hidden
        type="file"
        aria-label="Cover image file"
        disabled={busy || conflict}
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const next = event.target.files?.[0];
          event.target.value = "";
          void selectFile(next);
        }}
      />
      {pending === "upload" || pending === "select" ? (
        <Stack spacing={1} role="status" aria-live="polite">
          <Skeleton
            variant="rounded"
            animation="wave"
            sx={{ width: "100%", height: "auto", aspectRatio: "16 / 9" }}
          />
          <Typography variant="body2" color="text.secondary">
            {pending === "upload"
              ? "Uploading and processing your crop…"
              : "Preparing image…"}
          </Typography>
        </Stack>
      ) : source ? (
        <CoverCropper
          source={source}
          crop={crop}
          onChange={setCrop}
          disabled={busy || conflict}
        />
      ) : assetId ? (
        <Box
          sx={{
            aspectRatio: "16 / 9",
            bgcolor: "action.hover",
            borderRadius: 1,
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
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
              src={`/api/events/${eventId}/cover/${assetId}/1280`}
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
                objectFit: "cover",
              }}
            />
          )}
        </Box>
      ) : (
        <EmptyState
          icon={<AddPhotoAlternateOutlined />}
          title="Give your event a cover"
          description="Add a photo or illustration to introduce your event. You’ll choose exactly what appears in the frame."
          action={chooseButton}
        />
      )}
      {(source || assetId) && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "center" } }}
        >
          {chooseButton}
          {source && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setFile(undefined);
                setSource(null);
              }}
            >
              Cancel selection
            </Button>
          )}
          {file && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ overflowWrap: "anywhere", minWidth: 0 }}
            >
              {file.name}
            </Typography>
          )}
        </Stack>
      )}
      {(assetId || source) && (
        <TextField
          label="Alternative text (optional)"
          value={alt}
          onChange={(event) => {
            setAlt(event.target.value);
            feedback.clear("alt");
          }}
          {...feedback.field("alt")}
          helperText={
            feedback.errors.alt ??
            "Describe the image for screen readers. Leave blank if it is purely decorative."
          }
          disabled={busy || conflict}
          fullWidth
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
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
      {assetId && assetId !== cover.assetId && !source && (
        <Alert severity="info">
          Your cropped image is uploaded. Save cover to apply it to the event.
        </Alert>
      )}
      {(source || assetId || pending) && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          {source ? (
            <Button
              type="button"
              variant="contained"
              startIcon={<CloudUploadOutlined />}
              disabled={busy || conflict}
              onClick={() => void mutate("upload")}
            >
              {pending === "upload" ? "Uploading…" : "Upload cropped image"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="contained"
              disabled={!assetId || !changed || busy || conflict}
              onClick={() => void mutate("save")}
            >
              {pending === "save" ? "Saving…" : "Save cover"}
            </Button>
          )}
          {assetId !== cover.assetId && !source && (
            <Button
              type="button"
              disabled={busy || conflict}
              onClick={() => {
                setAssetId(cover.assetId);
                setAlt(cover.alt ?? "");
                feedback.reset();
              }}
            >
              Discard upload
            </Button>
          )}
          {cover.assetId && (
            <Button
              type="button"
              color="error"
              disabled={busy || conflict}
              onClick={() => void mutate("save", true)}
            >
              Remove cover
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
