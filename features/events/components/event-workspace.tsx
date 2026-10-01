"use client";

import { Alert } from "@mui/material";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { readCurrentEventAccess } from "@/features/events/event-access-action";
import type { EventRole } from "@/features/events/server/event-access";

export function EventWorkspace({
  eventId,
  role,
  children,
}: {
  eventId: string;
  role: EventRole;
  children: ReactNode;
}) {
  const router = useRouter();
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    const source = new EventSource(
      `/api/events/${eventId}/applications/stream`,
    );
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checking = false;
    let queued = false;
    const recheck = async () => {
      if (checking) {
        queued = true;

        return;
      }

      checking = true;

      try {
        const current = await readCurrentEventAccess(eventId);

        if (disposed) {
          return;
        }

        if (current !== role) {
          setChanged(true);
          source.close();
          // Discard privileged local state and the client router cache on role changes.
          window.location.replace(
            current
              ? `/dashboard/events/${eventId}?access=changed`
              : "/dashboard?access=changed",
          );

          return;
        }

        router.refresh();
      } catch {
        // A failed network request is not evidence of revoked access.
      } finally {
        checking = false;

        if (queued && !disposed) {
          queued = false;
          schedule();
        }
      }
    };
    const schedule = () => {
      if (timer !== undefined) {
        return;
      }

      timer = setTimeout(() => {
        timer = undefined;
        void recheck();
      }, 150);
    };
    source.addEventListener("connected", schedule);
    source.addEventListener("invalidate", schedule);
    // Bounded stream expiry/reconnect also detects a lost membership signal.
    source.addEventListener("error", schedule);

    return () => {
      disposed = true;
      clearTimeout(timer);
      source.close();
    };
  }, [eventId, role, router]);

  return changed ? (
    <Alert severity="info">Your access to this event has changed.</Alert>
  ) : (
    children
  );
}
