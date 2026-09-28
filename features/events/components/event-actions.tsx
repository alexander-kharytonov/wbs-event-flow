"use client";

import ArchiveOutlined from "@mui/icons-material/ArchiveOutlined";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";
import CancelOutlined from "@mui/icons-material/CancelOutlined";
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
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { changeEventLifecycle } from "@/features/events/event-lifecycle-action";
import { publishEvent } from "@/features/events/publish-event-action";
import type { PublishResult } from "@/features/events/server/publish-event";
import { useNotifications } from "@/hooks/use-notifications";

type Action = "cancel" | "unpublish" | "archive" | "restore" | "delete";
const labels: Record<Action, string> = {
  cancel: "Cancel event",
  unpublish: "Unpublish",
  archive: "Archive",
  restore: "Restore from archive",
  delete: "Delete draft",
};
const actionIcons = {
  cancel: CancelOutlined,
  unpublish: UnpublishedOutlined,
  archive: ArchiveOutlined,
  restore: UnarchiveOutlined,
  delete: DeleteOutlined,
};
const descriptions: Record<Action, string> = {
  cancel:
    "Cancellation is permanent. Pending and approved applicants will be notified. Applications and publication history will be preserved.",
  unpublish:
    "The public page will become unavailable. Applications and publication history will be preserved.",
  archive:
    "Move this event to Archived. Its public page and attendee registrations will stay as they are.",
  restore:
    "Return this event to My events. Completed and cancelled events remain read-only.",
  delete:
    "Permanently delete this draft and its registration form. This cannot be undone.",
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
  const router = useRouter();
  const notifications = useNotifications();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const menuId = useId();
  const [publication, setPublication] = useState<PublishResult>({});
  const hasMenu = Boolean(publishLabel || actions.length);

  return (
    <Stack
      spacing={1}
      sx={{ flexShrink: 0, alignSelf: "flex-start", maxWidth: "100%" }}
    >
      <ButtonGroup
        variant="outlined"
        aria-label="Event controls"
        disabled={pending}
      >
        <Button
          href={readOnly ? undefined : `/dashboard/events/${eventId}/edit`}
          disabled={readOnly || pending}
          startIcon={<EditOutlined />}
        >
          Edit event
        </Button>
        {hasMenu && (
          <Button
            size="small"
            aria-label="More event actions"
            aria-haspopup="menu"
            aria-controls={anchor ? menuId : undefined}
            aria-expanded={Boolean(anchor)}
            onClick={(event) => setAnchor(event.currentTarget)}
            sx={{ px: 0.75 }}
          >
            <ArrowDropDown />
          </Button>
        )}
      </ButtonGroup>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {publishLabel && (
          <MenuItem
            disabled={pending || publication.conflict}
            onClick={() => {
              setAnchor(null);
              notifications.close(`publish:${eventId}`);
              startTransition(async () => {
                try {
                  const result = await publishEvent({
                    eventId,
                    contentVersion,
                  });
                  setPublication(result);

                  if (result.success) {
                    notifications.show("Event published.", {
                      severity: "success",
                      autoHideDuration: 4000,
                      key: `publish:${eventId}`,
                    });
                    router.refresh();
                  } else if (result.message && !result.conflict) {
                    notifications.show(result.message, {
                      severity: "error",
                      key: `publish:${eventId}`,
                    });
                  }
                } catch {
                  setPublication({
                    conflict: true,
                    message:
                      "We couldn’t confirm publication. Reload the event to check its status.",
                  });
                }
              });
            }}
          >
            <ListItemIcon sx={{ color: "inherit" }}>
              <PublishOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>{publishLabel}</ListItemText>
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
                setError("");
                setReason("");
              }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{labels[value]}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
      {publication.conflict && publication.message && (
        <Alert severity="error" sx={{ maxWidth: 320 }}>
          {publication.message}
          <Button href={`/dashboard/events/${eventId}`}>Reload event</Button>
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
          {action && labels[action]}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {action && descriptions[action]}
          </DialogContentText>
          {action === "cancel" && (
            <TextField
              autoFocus
              fullWidth
              required
              multiline
              minRows={3}
              label="Cancellation reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              helperText={`${reason.trim().length}/2000 · This reason will be shared with applicants.`}
              sx={{ mt: 3 }}
            />
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={pending} onClick={() => setAction(null)}>
            Keep event
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

                try {
                  const result = await changeEventLifecycle({
                    eventId,
                    action,
                    ...(action === "cancel" ? { reason } : {}),
                  });

                  if (!result.success) {
                    setError(result.message ?? "Could not update this event.");

                    return;
                  }

                  setAction(null);
                  notifications.show("Event updated.", {
                    severity: "success",
                    autoHideDuration: 4000,
                  });

                  if (result.deleted) {
                    router.push("/dashboard");
                  }

                  router.refresh();
                } catch {
                  setError(
                    "Could not confirm this action. Reload to check the event.",
                  );
                }
              })
            }
          >
            {pending ? "Saving…" : action && labels[action]}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
