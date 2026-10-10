"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { publishEvent } from "@/features/events/publish-event-action";
import type { PublishResult } from "@/features/events/server/publish-event";
import { useNotifications } from "@/hooks/use-notifications";

export function useEventPublication(eventId: string, contentVersion: number) {
  const router = useRouter();
  const notifications = useNotifications();
  const [publication, setPublication] = useState<PublishResult>({});
  const [pending, startTransition] = useTransition();

  function publish() {
    notifications.close(`publish:${eventId}`);
    startTransition(async () => {
      try {
        const result = await publishEvent({ eventId, contentVersion });
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
  }

  return { publication, pending, publish };
}
