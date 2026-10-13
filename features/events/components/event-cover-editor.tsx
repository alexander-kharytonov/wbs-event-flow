"use client";

import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import {
  CoverCropper,
  type CoverSource,
} from "@/features/events/components/cover-cropper";
import { EventText } from "@/features/events/components/event-text";
import { initialCoverCrop } from "@/features/events/cover-crop";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import type { Messages } from "@/lib/i18n/messages";

export type EditableCover = { assetId: string | null; alt: string | null };

export function EventCoverEditor({
  eventId,
  initial,
  version,
  disabled,
  begin,
  end,
  onSaved,
  onDirtyChange,
  onConflictChange,
  onUnpreparedChange,
  onPreparedChange,
}: {
  eventId?: string;
  initial: EditableCover;
  version: string;
  disabled: boolean;
  begin: () => boolean;
  end: () => void;
  onSaved: (version: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onConflictChange: (conflict: boolean) => void;
  onUnpreparedChange?: (unprepared: boolean) => void;
  onPreparedChange?: (assetId: string | null) => void;
}) {
  const t = useTranslations("events");
  const [progress, setProgress] = useState(0);
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
  const feedback = useFormFeedback<keyof Messages["events"]>({}, (code) =>
    t(code),
  );
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
      feedback.setMessage("coverChooseValid");

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
        feedback.setMessage("coverDimensions");

        return;
      }

      setSource({ url: URL.createObjectURL(next), width, height });
      setFile(next);
      setCrop(initialCoverCrop);
    } catch {
      if (current === selection.current) {
        feedback.setMessage("coverOpenFailed");
      }
    } finally {
      if (current === selection.current) {
        setPending(null);
        end();
      }
    }
  }

  async function uploadTemporary(controller: AbortController) {
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/event-covers/uploads");
      xhr.timeout = 90_000;
      xhr.setRequestHeader("Content-Type", file?.type ?? "");
      xhr.setRequestHeader("X-Event-Cover-Crop", JSON.stringify(crop));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          setProgress(Math.round((event.loaded / event.total) * 100));
      };
      const abort = () => xhr.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      xhr.onloadend = () =>
        controller.signal.removeEventListener("abort", abort);
      xhr.onload = () =>
        resolve(new Response(xhr.responseText, { status: xhr.status }));
      xhr.onerror =
        xhr.ontimeout =
        xhr.onabort =
          () => reject(new Error("Upload unconfirmed"));
      xhr.send(file);
    });
  }

  async function removeTemporary() {
    if (disabled || pending || !begin()) {
      return;
    }
    setPending("save");
    feedback.reset();

    try {
      if (assetId) {
        const response = await fetch(`/api/event-covers/${assetId}`, {
          method: "DELETE",
        });

        if (!response.ok && response.status !== 404) {
          feedback.setMessage("coverSaveFailed");

          return;
        }
      }
      setAssetId(null);
      setAlt("");
      setFile(undefined);
      setSource(null);
    } catch {
      feedback.setMessage("coverConfirmFailed");
    } finally {
      setPending(null);
      end();
    }
  }

  async function mutate(kind: "upload" | "save", remove = false) {
    if (disabled || pending || (kind === "upload" && !file)) {
      return;
    }
    feedback.reset();

    if (kind === "save" && !remove && alt.trim().length > 500) {
      feedback.setErrors({ alt: "coverAltLong" });

      return;
    }

    if (!begin()) {
      return;
    }
    setPending(kind);
    setProgress(0);
    const controller = new AbortController();
    request.current = controller;

    try {
      const response =
        !eventId && kind === "upload"
          ? await uploadTemporary(controller)
          : await fetch(
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
        if (eventId && response.status === 409) {
          setConflict(true);
        }
        feedback.setMessage(
          typeof result.code === "string" &&
            t.has(result.code as keyof Messages["events"])
            ? (result.code as keyof Messages["events"])
            : "coverSaveFailed",
        );

        return;
      }

      if (kind === "upload") {
        if (!eventId && assetId) {
          // A failed discard stays tracked and expires automatically.
          void fetch(`/api/event-covers/${assetId}`, {
            method: "DELETE",
          }).catch(() => {});
        }
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
          <EventText id={remove ? "coverRemoved" : "coverSaved"} />,
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
        feedback.setMessage("coverConfirmFailed");
      }
    } finally {
      setPending(null);
      end();
    }
  }

  const busy = disabled || Boolean(pending);
  const changed =
    assetId !== cover.assetId || (alt.trim() || null) !== cover.alt;
  useEffect(() => {
    onDirtyChange(changed || Boolean(source));
  }, [changed, source, onDirtyChange]);
  useEffect(() => {
    onConflictChange(conflict);
  }, [conflict, onConflictChange]);
  useEffect(() => {
    onUnpreparedChange?.(Boolean(source));
  }, [source, onUnpreparedChange]);
  useEffect(() => {
    onPreparedChange?.(assetId);
  }, [assetId, onPreparedChange]);
  const chooseButton = (
    <Button
      type="button"
      variant="outlined"
      startIcon={<AddPhotoAlternateOutlined />}
      disabled={busy || conflict}
      onClick={() => fileInput.current?.click()}
    >
      {assetId || source ? t("coverChooseAnother") : t("coverChoose")}
    </Button>
  );

  return (
    <Stack
      component="section"
      spacing={2}
      useFlexGap
      aria-label={t("coverEvent")}
      aria-busy={Boolean(pending)}
    >
      <SectionHeader
        title={t("coverImage")}
        description={t(eventId ? "coverHint" : "creationCoverHint")}
      />
      {!eventId && (
        <>
          <input type="hidden" name="temporaryCoverId" value={assetId ?? ""} />
          <input
            type="hidden"
            name="temporaryCoverAlt"
            value={assetId ? alt.trim() : ""}
          />
        </>
      )}
      <input
        ref={fileInput}
        hidden
        type="file"
        aria-label={t("coverFile")}
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
          {!eventId && pending === "upload" && (
            <LinearProgress
              aria-label={t("coverUploading")}
              variant={progress < 100 ? "determinate" : "indeterminate"}
              value={progress}
            />
          )}
          <Typography variant="body2" color="text.secondary">
            {!eventId && pending === "upload" && progress < 100
              ? t("creationUploadProgress", { percent: progress })
              : pending === "upload"
                ? t("coverProcessing")
                : t("coverPreparing")}
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
              {t("coverUnavailableHint")}
            </Typography>
          ) : (
            <Box
              component="img"
              src={
                eventId
                  ? `/api/events/${eventId}/cover/${assetId}/1280`
                  : `/api/event-covers/${assetId}/1280`
              }
              alt={alt || t("coverPreview")}
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
          title={t("coverEmpty")}
          description={t("coverEmptyHint")}
          action={chooseButton}
        />
      )}
      {(source || file || assetId !== cover.assetId) && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "center" } }}
        >
          {source && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setFile(undefined);
                setSource(null);
              }}
            >
              {t("coverCancelSelection")}
            </Button>
          )}
          {eventId && assetId !== cover.assetId && !source && (
            <Button
              type="button"
              disabled={busy || conflict}
              onClick={() => {
                setAssetId(cover.assetId);
                setAlt(cover.alt ?? "");
                feedback.reset();
              }}
            >
              {t("coverDiscard")}
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
          label={t("coverAlt")}
          value={alt}
          onChange={(event) => {
            setAlt(event.target.value);
            feedback.clear("alt");
          }}
          {...feedback.field("alt")}
          helperText={
            (feedback.errors.alt ? t(feedback.errors.alt) : undefined) ??
            t("coverAltHint")
          }
          disabled={busy || conflict}
          fullWidth
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
      )}
      {feedback.message && <Alert severity="error">{feedback.message}</Alert>}
      {conflict && (
        <Alert severity="error">
          {t("coverChanged")}{" "}
          <Button
            component="a"
            href={`/dashboard/events/${eventId}/edit`}
            color="inherit"
          >
            {t("reloadLatest")}
          </Button>
        </Alert>
      )}
      {assetId && assetId !== cover.assetId && !source && (
        <Alert severity="info">
          {t(eventId ? "coverUploadedHint" : "creationCoverReady")}
        </Alert>
      )}
      {(source || assetId || pending) && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          useFlexGap
          sx={{ alignItems: { xs: "stretch", sm: "center" } }}
        >
          {(eventId ? cover.assetId : assetId || source) && (
            <Button
              type="button"
              color="error"
              sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
              disabled={busy || conflict}
              onClick={() =>
                void (eventId ? mutate("save", true) : removeTemporary())
              }
            >
              {t("coverRemove")}
            </Button>
          )}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ ml: { sm: "auto" } }}
          >
            {chooseButton}
            {source ? (
              <Button
                type="button"
                variant="contained"
                startIcon={<CloudUploadOutlined />}
                disabled={busy || conflict}
                onClick={() => void mutate("upload")}
              >
                {pending === "upload"
                  ? t("coverUploading")
                  : t("coverUploadCrop")}
              </Button>
            ) : eventId ? (
              <Button
                type="button"
                variant="contained"
                disabled={!assetId || !changed || busy || conflict}
                onClick={() => void mutate("save")}
              >
                {pending === "save" ? t("saving") : t("coverSave")}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
