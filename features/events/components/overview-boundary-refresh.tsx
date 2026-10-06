"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function OverviewBoundaryRefresh({
  boundaryAt,
}: {
  boundaryAt: string | null;
}) {
  const router = useRouter();
  const refreshedBoundary = useRef<string | null>(null);

  useEffect(() => {
    if (!boundaryAt) {
      return;
    }

    const deadline = Date.parse(boundaryAt);
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);

      if (disposed || refreshedBoundary.current === boundaryAt) {
        return;
      }

      const remaining = deadline - Date.now();

      if (remaining <= 0) {
        // Keep this guard across refreshes, even if the server returns the same boundary.
        refreshedBoundary.current = boundaryAt;
        router.refresh();

        return;
      }

      // Long upcoming events may exceed the platform's single-timeout limit.
      timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    };
    const checkVisible = () => {
      if (document.visibilityState === "visible") {
        schedule();
      }
    };
    document.addEventListener("visibilitychange", checkVisible);
    window.addEventListener("focus", checkVisible);
    window.addEventListener("pageshow", checkVisible);
    schedule();

    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkVisible);
      window.removeEventListener("focus", checkVisible);
      window.removeEventListener("pageshow", checkVisible);
    };
  }, [boundaryAt, router]);

  return null;
}
