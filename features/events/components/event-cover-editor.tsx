"use client";

import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { CoverCropper } from "@/features/events/components/cover-cropper";
import {
  type EventCoverOptions,
  useEventCover,
} from "@/features/events/use-event-cover";

export type { EditableCover } from "@/features/events/use-event-cover";

export function EventCoverEditor(options: EventCoverOptions) {
  const { eventId } = options;
  const t = useTranslations("events");
  const fileInput = useRef<HTMLInputElement>(null);
  const [failedAssetId, setFailedAssetId] = useState<string>();
  const {
    progress,
    cover,
    assetId,
    alt,
    file,
    pending,
    source,
    crop,
    setCrop,
    conflict,
    feedback,
    busy,
    changed,
    selectFile,
    mutate,
    removeTemporary,
    discardUpload,
    changeAlt,
  } = useEventCover(options);
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
          {eventId && assetId !== cover.assetId && !source && (
            <Button
              type="button"
              disabled={busy || conflict}
              onClick={discardUpload}
            >
              {t("coverDiscard")}
            </Button>
          )}
          {file && (
            <Chip
              icon={<ImageOutlined />}
              label={file.name}
              title={file.name}
              size="small"
              variant="outlined"
              sx={{ maxWidth: "100%", minWidth: 0, alignSelf: "flex-start" }}
            />
          )}
        </Stack>
      )}
      {(assetId || source) && (
        <TextField
          label={t("coverAlt")}
          value={alt}
          onChange={(event) => changeAlt(event.target.value)}
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
          {(source || assetId || cover.assetId) && (
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
