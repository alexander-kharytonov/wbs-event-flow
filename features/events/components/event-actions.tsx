"use client";

import ArchiveOutlined from "@mui/icons-material/ArchiveOutlined";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";
import CancelOutlined from "@mui/icons-material/CancelOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PublishOutlined from "@mui/icons-material/PublishOutlined";
import UnarchiveOutlined from "@mui/icons-material/UnarchiveOutlined";
import UnpublishedOutlined from "@mui/icons-material/UnpublishedOutlined";
import {
  Alert,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { EventText } from "@/features/events/components/event-text";
import { changeEventLifecycle } from "@/features/events/event-lifecycle-action";
import { useEventPublication } from "@/features/events/use-event-publication";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { useNotifications } from "@/hooks/use-notifications";
import type { Messages } from "@/lib/i18n/messages";

type Action = "cancel" | "unpublish" | "archive" | "restore" | "delete";
const labels: Record<Action, keyof Messages["events"]> = {
  cancel: "eventCancel",
  unpublish: "eventUnpublish",
  archive: "eventArchive",
  restore: "eventRestore",
  delete: "eventDeleteDraft",
};
const actionIcons = {
  cancel: CancelOutlined,
  unpublish: UnpublishedOutlined,
  archive: ArchiveOutlined,
  restore: UnarchiveOutlined,
  delete: DeleteOutlined,
};
const descriptions: Record<Action, keyof Messages["events"]> = {
  cancel: "eventCancelHint",
  unpublish: "eventUnpublishHint",
  archive: "eventArchiveHint",
  restore: "eventRestoreHint",
  delete: "eventDeleteHint",
};

export function EventActions({
  eventId,
  actions,
  readOnly,
  publishLabel,
  contentVersion,
}: {
  eventId: string;
  actions: Action[];
  readOnly: boolean;
  publishLabel: string | null;
  contentVersion: number;
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const notifications = useNotifications();
  const feedback = useFormFeedback<keyof Messages["events"]>({}, (code) =>
    t(code),
  );
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [lifecyclePending, startTransition] = useTransition();
  const {
    publication,
    pending: publishPending,
    publish,
  } = useEventPublication(eventId, contentVersion);
  const pending = lifecyclePending || publishPending;

  const menuId = useId();

  return (
    <Stack
      spacing={1}
      sx={{ flexShrink: 0, alignSelf: "flex-start", maxWidth: "100%" }}
    >
      <ButtonGroup
        variant="outlined"
        aria-label={t("eventControls")}
        disabled={pending}
      >
        <Button
          component={NextLink}
          scroll={false}
          href={`/dashboard/events/${eventId}/edit`}
          disabled={readOnly || pending}
          startIcon={<EditOutlined />}
        >
          {t("eventEdit")}
        </Button>
        <Button
          size="small"
          aria-label={t("eventMoreActions")}
          aria-haspopup="menu"
          aria-controls={anchor ? menuId : undefined}
          aria-expanded={Boolean(anchor)}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ px: 0.75 }}
        >
          <ArrowDropDown />
        </Button>
      </ButtonGroup>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          component={NextLink}
          href={`/dashboard/events/new?duplicateFrom=${eventId}`}
          prefetch={false}
          scroll={false}
          onClick={() => setAnchor(null)}
        >
          <ListItemIcon>
            <ContentCopyOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("eventDuplicate")}</ListItemText>
        </MenuItem>
        {(publishLabel || actions.length > 0) && <Divider />}
        {publishLabel && (
          <MenuItem
            disabled={pending || publication.conflict}
            onClick={() => {
              setAnchor(null);
              publish();
            }}
          >
            <ListItemIcon sx={{ color: "inherit" }}>
              <PublishOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              {t(
                publishLabel === "Publish changes"
                  ? "publishChanges"
                  : publishLabel === "Republish"
                    ? "republish"
                    : "publish",
              )}
            </ListItemText>
          </MenuItem>
        )}
        {publishLabel && actions.length > 0 && <Divider />}
        {actions.map((value) => {
          const Icon = actionIcons[value];

          return (
            <MenuItem
              key={value}
              sx={{
                color:
                  value === "cancel" || value === "delete"
                    ? "error.main"
                    : undefined,
              }}
              onClick={() => {
                setAnchor(null);
                setAction(value);
                notifications.close(`event-action:${eventId}`);
                setReason("");
                feedback.reset();
              }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t(labels[value])}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
      {publication.conflict && publication.message && (
        <Alert severity="error" sx={{ maxWidth: 320 }}>
          {publication.message && t(publication.message)}
          <Button component="a" href={`/dashboard/events/${eventId}`}>
            {t("eventReload")}
          </Button>
        </Alert>
      )}
      <Dialog
        open={action !== null}
        onClose={() => {
          if (!pending) {
            setAction(null);
          }
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="event-action-title"
      >
        <DialogTitle id="event-action-title">
          {action && t(labels[action])}
        </DialogTitle>
        <DialogContent>
          {action === "cancel" || action === "unpublish" ? (
            <Alert severity={action === "cancel" ? "error" : "warning"}>
              {t(descriptions[action])}
            </Alert>
          ) : (
            <DialogContentText>
              {action && t(descriptions[action])}
            </DialogContentText>
          )}
          {action === "cancel" && (
            <TextField
              autoFocus
              fullWidth
              required
              multiline
              minRows={3}
              label={t("eventCancelReason")}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                feedback.clear("reason");
              }}
              error={Boolean(feedback.errors.reason)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              helperText={
                (feedback.errors.reason
                  ? t(feedback.errors.reason)
                  : undefined) ??
                t("eventReasonHint", { count: reason.trim().length })
              }
              sx={{ mt: 3 }}
            />
          )}
        </DialogContent>
        {feedback.message && (
          <Alert severity="error" sx={{ mx: 3 }}>
            {feedback.message}
          </Alert>
        )}
        <DialogActions>
          <Button disabled={pending} onClick={() => setAction(null)}>
            {t("eventKeep")}
          </Button>
          <Button
            variant="contained"
            color={
              action === "cancel" || action === "delete" ? "error" : "primary"
            }
            disabled={pending || (action === "cancel" && !reason.trim())}
            onClick={() =>
              startTransition(async () => {
                if (!action) {
                  return;
                }

                feedback.reset();

                if (
                  action === "cancel" &&
                  (!reason.trim() || reason.trim().length > 2000)
                ) {
                  feedback.setErrors({
                    reason: "eventReasonInvalid",
                  });

                  return;
                }

                try {
                  const result = await changeEventLifecycle({
                    eventId,
                    action,
                    ...(action === "cancel" ? { reason } : {}),
                  });

                  if (!result.success) {
                    feedback.setErrors(result.fieldErrors ?? {});
                    feedback.setMessage(result.message ?? "eventUpdateFailed");

                    return;
                  }

                  setAction(null);
                  notifications.show(<EventText id="eventUpdated" />, {
                    severity: "success",
                  });

                  if (result.deleted) {
                    router.push("/dashboard/events");
                  }

                  router.refresh();
                } catch {
                  feedback.setMessage("eventActionUnconfirmed");
                }
              })
            }
          >
            {pending ? t("saving") : action && t(labels[action])}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
