"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ApplicationRealtime({ streamUrl }: { streamUrl: string }) {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource(streamUrl);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (timer !== undefined) {
        return;
      }

      timer = setTimeout(() => {
        timer = undefined;
        router.refresh();
      }, 150);
    };
    // Initial connection closes the read-to-subscribe gap; reconnects recover
    // missed notifications because LISTEN/NOTIFY has no replay.
    source.addEventListener("connected", scheduleRefresh);
    source.addEventListener("invalidate", scheduleRefresh);

    return () => {
      source.close();
      clearTimeout(timer);
    };
  }, [router, streamUrl]);

  return null;
}
