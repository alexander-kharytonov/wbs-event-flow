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
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
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
}: {
  eventId: string;
  initial: EditableCover;
  version: string;
  disabled: boolean;
  begin: () => boolean;
  end: () => void;
  onSaved: (version: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onConflictChange: (conflict: boolean) => void;
}) {
  const t = useTranslations("events");
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
          typeof result.code === "string" &&
            t.has(result.code as keyof Messages["events"])
            ? (result.code as keyof Messages["events"])
            : "coverSaveFailed",
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
      aria-label={t("coverEvent")}
      aria-busy={Boolean(pending)}
    >
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
      >
        <Typography variant="h6" component="h2">
          {t("coverImage")}
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          label={
            source
              ? t("coverAdjust")
              : assetId !== cover.assetId
                ? t("coverReady")
                : assetId
                  ? t("coverSavedLabel")
                  : "16:9"
          }
        />
      </Stack>
      <Alert severity="info">{t("coverHint")}</Alert>
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
          <Typography variant="body2" color="text.secondary">
            {pending === "upload" ? t("coverProcessing") : t("coverPreparing")}
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
              src={`/api/events/${eventId}/cover/${assetId}/1280`}
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
        <Alert severity="info">{t("coverUploadedHint")}</Alert>
      )}
      {(source || assetId || pending) && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          useFlexGap
          sx={{ alignItems: { xs: "stretch", sm: "center" } }}
        >
          {cover.assetId && (
            <Button
              type="button"
              color="error"
              sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
              disabled={busy || conflict}
              onClick={() => void mutate("save", true)}
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
            ) : (
              <Button
                type="button"
                variant="contained"
                disabled={!assetId || !changed || busy || conflict}
                onClick={() => void mutate("save")}
              >
                {pending === "save" ? t("saving") : t("coverSave")}
              </Button>
            )}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
