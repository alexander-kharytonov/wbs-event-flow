"use client";

import LinkOutlined from "@mui/icons-material/LinkOutlined";
import OpenInNew from "@mui/icons-material/OpenInNew";
import { Button, Stack } from "@mui/material";
import { useTranslations } from "next-intl";
import { EventText } from "@/features/events/components/event-text";
import { useNotifications } from "@/hooks/use-notifications";

export function PublicEventLinks({ publicId }: { publicId: string }) {
  const t = useTranslations("events");
  const notifications = useNotifications();

  return (
    <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap" }}>
      <Button
        size="small"
        startIcon={<OpenInNew />}
        href={`/e/${publicId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("publicPageOpen")}
      </Button>
      <Button
        size="small"
        startIcon={<LinkOutlined />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              new URL(`/e/${publicId}`, window.location.origin).href,
            );
            notifications.show(<EventText id="publicLinkCopied" />, {
              severity: "success",
              key: "copy-event-link",
              autoHideDuration: 3000,
            });
          } catch {
            notifications.show(<EventText id="publicLinkCopyFailed" />, {
              severity: "error",
              key: "copy-event-link",
            });
          }
        }}
      >
        {t("publicLinkCopy")}
      </Button>
    </Stack>
  );
}
