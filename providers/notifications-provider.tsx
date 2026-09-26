"use client";

import Close from "@mui/icons-material/Close";
import {
  Alert,
  Badge,
  Button,
  IconButton,
  Portal,
  Snackbar,
  SnackbarContent,
} from "@mui/material";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
  type NotificationOptions,
  NotificationsContext,
} from "@/hooks/use-notifications";

type Notification = {
  key: string;
  message: ReactNode;
  options: NotificationOptions;
};

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Notification[]>([]);
  const sequence = useRef(0);
  const show = useCallback(
    (message: ReactNode, options: NotificationOptions = {}) => {
      const key = options.key ?? `notification-${++sequence.current}`;
      setQueue((current) => {
        if (current.some((item) => item.key === key)) {
          return current;
        }

        return [...current, { key, message, options }];
      });

      return key;
    },
    [],
  );
  const close = useCallback((key: string) => {
    setQueue((current) => current.filter((item) => item.key !== key));
  }, []);
  const notifications = useMemo(() => ({ show, close }), [show, close]);
  const active = queue[0];
  const action = active && (
    <>
      {active.options.onAction && (
        <Button color="inherit" size="small" onClick={active.options.onAction}>
          {active.options.actionText ?? "Action"}
        </Button>
      )}
      <IconButton
        size="small"
        color="inherit"
        aria-label="Close notification"
        title="Close"
        onClick={() => close(active.key)}
      >
        <Close fontSize="small" />
      </IconButton>
    </>
  );

  return (
    <NotificationsContext.Provider value={notifications}>
      {children}
      {active && (
        <Portal>
          <Snackbar
            key={active.key}
            open
            autoHideDuration={active.options.autoHideDuration ?? null}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            onClose={(_, reason) => {
              if (reason !== "clickaway") {
                close(active.key);
              }
            }}
          >
            <Badge
              badgeContent={queue.length > 1 ? String(queue.length) : null}
              color="primary"
              sx={{ width: "100%" }}
              aria-label={
                queue.length > 1 ? `${queue.length} notifications` : undefined
              }
            >
              {active.options.severity ? (
                <Alert
                  variant="filled"
                  severity={active.options.severity}
                  action={action}
                  role={
                    active.options.severity === "error" ||
                    active.options.severity === "warning"
                      ? "alert"
                      : "status"
                  }
                  sx={{
                    width: "100%",
                    maxWidth: 560,
                    overflowWrap: "anywhere",
                  }}
                >
                  {active.message}
                </Alert>
              ) : (
                <SnackbarContent
                  message={active.message}
                  action={action}
                  sx={{ maxWidth: 560, overflowWrap: "anywhere" }}
                />
              )}
            </Badge>
          </Snackbar>
        </Portal>
      )}
    </NotificationsContext.Provider>
  );
}
