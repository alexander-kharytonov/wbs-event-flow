"use client";

import { Button, Stack, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { EventText } from "@/features/events/components/event-text";
import {
  approveApplication,
  rejectApplication,
} from "@/features/events/review-application-actions";
import type { ReviewResult } from "@/features/events/server/review-application";
import { useNotifications } from "@/hooks/use-notifications";

export function ApplicationReviewControls({
  eventId,
  applicationId,
}: {
  eventId: string;
  applicationId: string;
}) {
  const t = useTranslations("events");
  const notifications = useNotifications();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReviewResult>({});

  function decide(action: typeof approveApplication) {
    notifications.close(`review:${applicationId}`);
    startTransition(async () => {
      try {
        const outcome = await action({ eventId, applicationId });
        setResult(outcome);

        if (outcome.success) {
          notifications.show(
            <EventText
              id={
                action === approveApplication
                  ? "applicationApproved"
                  : "applicationRejected"
              }
            />,
            {
              severity: "success",
              autoHideDuration: 4000,
              key: `review:${applicationId}`,
            },
          );
        } else if (outcome.message) {
          notifications.show(<EventText id={outcome.message} />, {
            severity:
              outcome.code === "CAPACITY_REACHED" ||
              outcome.code === "ALREADY_REVIEWED"
                ? "warning"
                : "error",
            key: `review:${applicationId}`,
          });
        }
      } catch {
        notifications.show(<EventText id="applicationConfirmFailed" />, {
          severity: "error",
          key: `review:${applicationId}`,
        });
      }
    });
  }

  return (
    <Stack spacing={1.5} aria-busy={pending}>
      <Typography variant="body2" color="text.secondary">
        {t("applicationFinalHint")}
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <Button
          variant="outlined"
          color="error"
          disabled={
            pending || result.success || result.code === "ALREADY_REVIEWED"
          }
          onClick={() => decide(rejectApplication)}
        >
          {t("applicationReject")}
        </Button>
        <Button
          variant="contained"
          disabled={
            pending || result.success || result.code === "ALREADY_REVIEWED"
          }
          onClick={() => decide(approveApplication)}
        >
          {t("applicationApprove")}
        </Button>
      </Stack>
      {pending && (
        <Typography variant="body2" role="status">
          {t("applicationSaving")}
        </Typography>
      )}
    </Stack>
  );
}
