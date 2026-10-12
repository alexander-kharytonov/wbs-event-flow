"use client";

import InfoOutlined from "@mui/icons-material/InfoOutlined";
import OpenInNew from "@mui/icons-material/OpenInNew";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";

type Props = {
  eventId?: string;
  createdId?: string;
  message?: string;
  serverMessage?: string;
  unmappedError?: string;
  errors: Record<string, string>;
  conflict: boolean;
  coverConflict: boolean;
  saved: boolean;
  pending: boolean;
  coverBusy: boolean;
  dirty: boolean;
  coverDirty: boolean;
  validationAttempted: boolean;
  requiredMissing: boolean;
  disabled: boolean;
  onShowErrors: () => void;
  onCheckRequired: () => void;
};

export function EventEditorActions({
  eventId,
  createdId,
  message,
  serverMessage,
  unmappedError,
  errors,
  conflict,
  coverConflict,
  saved,
  pending,
  coverBusy,
  dirty,
  coverDirty,
  validationAttempted,
  requiredMissing,
  disabled,
  onShowErrors,
  onCheckRequired,
}: Props) {
  const t = useTranslations("events");

  return (
    <Box
      sx={{
        position: "sticky",
        bottom: 0,
        zIndex: 2,
        bgcolor: "background.paper",
        borderTop: 1,
        borderColor: "divider",
        px: { xs: 2, sm: 4 },
        pt: { xs: 1, md: 2 },
        pb: "max(16px, env(safe-area-inset-bottom))",
        borderBottomRightRadius: 1,
        borderBottomLeftRadius: 1,
      }}
    >
      {(message ||
        unmappedError ||
        serverMessage ||
        conflict ||
        coverConflict) && (
        <Alert severity="error" role="alert" tabIndex={-1} data-editor-feedback>
          {conflict
            ? serverMessage
            : (message ??
              unmappedError ??
              serverMessage ??
              t("coverVersionChanged"))}
          {(conflict || coverConflict || serverMessage) && eventId && (
            <Box sx={{ mt: 1 }}>
              <Button
                color="inherit"
                size="small"
                component="a"
                href={`/dashboard/events/${eventId}/edit`}
              >
                {t("reloadLatest")}
              </Button>
            </Box>
          )}
        </Alert>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr) 44px minmax(0, 1fr) 44px",
            md: "minmax(0, 1fr) auto auto auto auto",
          },
          gridTemplateAreas: {
            xs: eventId
              ? '"status status status help" "save save save save" "preview preview back back"'
              : '"status status status help" "save save save save" "back back back back"',
            md: '"status save help preview back"',
          },
          gap: { xs: 0.5, md: 1 },
          alignItems: "center",
        }}
      >
        <Box
          role="status"
          aria-live="polite"
          sx={{ gridArea: "status", minWidth: 0 }}
        >
          {pending || createdId ? (
            <Typography variant="body2" color="text.secondary">
              {createdId
                ? t("openingEditor")
                : eventId
                  ? t("savingDraft")
                  : t("creatingEvent")}
            </Typography>
          ) : validationAttempted && Object.keys(errors).length > 0 ? (
            <Button
              variant="outlined"
              type="button"
              color="error"
              size="small"
              onClick={onShowErrors}
            >
              {t("reviewErrors")}
            </Button>
          ) : requiredMissing || disabled ? (
            <Button
              variant="outlined"
              type="button"
              size="small"
              onClick={onCheckRequired}
            >
              {t("completeRequiredFields")}
            </Button>
          ) : conflict ||
            coverConflict ||
            (serverMessage && !saved) ||
            !eventId ? (
            <Typography variant="body2" color="text.secondary">
              {conflict || coverConflict
                ? t("reloadRequired")
                : serverMessage && !saved
                  ? t("saveFailedEditsKept")
                  : t("readyToCreate")}
            </Typography>
          ) : null}
          {coverDirty && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.5 }}
            >
              {t("coverUnsaved")}
            </Typography>
          )}
        </Box>
        <Button
          type="submit"
          data-editor-save
          variant="contained"
          sx={{ gridArea: "save", minHeight: 44 }}
          disabled={
            pending ||
            Boolean(createdId) ||
            Boolean(conflict) ||
            coverConflict ||
            coverBusy ||
            (Boolean(eventId) && !dirty) ||
            requiredMissing ||
            disabled
          }
        >
          {pending
            ? eventId
              ? t("saving")
              : t("creating")
            : eventId
              ? t("saveDraft")
              : t("createEvent")}
        </Button>
        <Tooltip
          title={eventId ? t("saveDraftHint") : t("createDraftDescription")}
          enterTouchDelay={0}
        >
          <IconButton
            type="button"
            size="small"
            sx={{ gridArea: "help", justifySelf: "end" }}
            aria-label={eventId ? t("savePublishSeparate") : t("aboutDraft")}
          >
            <InfoOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
        {eventId && (
          <Tooltip title={t("previewSavedHint")} enterTouchDelay={0}>
            <Button
              component="a"
              href={`/dashboard/events/${eventId}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNew fontSize="small" />}
              aria-label={t("previewNewTab")}
              sx={{ gridArea: "preview", minHeight: 44, px: { xs: 1, md: 2 } }}
            >
              <Box
                component="span"
                sx={{ display: { xs: "inline", md: "none" } }}
              >
                {t("preview")}
              </Box>
              <Box
                component="span"
                sx={{ display: { xs: "none", md: "inline" } }}
              >
                {t("previewSaved")}
              </Box>
            </Button>
          </Tooltip>
        )}
        <Button
          href={eventId ? `/dashboard/events/${eventId}` : "/dashboard/events"}
          color="inherit"
          aria-label={eventId ? t("backEvent") : t("cancel")}
          sx={{ gridArea: "back", minHeight: 44, px: { xs: 1, md: 2 } }}
        >
          <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>
            {eventId ? t("back") : t("cancel")}
          </Box>
          <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
            {eventId ? t("backEvent") : t("cancel")}
          </Box>
        </Button>
      </Box>
    </Box>
  );
}
