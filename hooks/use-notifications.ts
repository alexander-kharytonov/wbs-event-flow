"use client";

import { createContext, type ReactNode, useContext } from "react";

export type NotificationOptions = {
  key?: string;
  actionText?: ReactNode;
  onAction?: () => void;
  severity?: "success" | "info" | "warning" | "error";
  autoHideDuration?: number | null;
};

type Notifications = {
  show: (message: ReactNode, options?: NotificationOptions) => string;
  close: (key: string) => void;
};

export const NotificationsContext = createContext<Notifications | null>(null);

export function useNotifications() {
  const notifications = useContext(NotificationsContext);

  if (!notifications) {
    throw new Error(
      "useNotifications must be used within NotificationsProvider.",
    );
  }

  return notifications;
}
