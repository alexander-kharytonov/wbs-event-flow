"use client";

import LinkOutlined from "@mui/icons-material/LinkOutlined";
import OpenInNew from "@mui/icons-material/OpenInNew";
import { Button, Stack } from "@mui/material";
import { useNotifications } from "@/hooks/use-notifications";

export function PublicEventLinks({ publicId }: { publicId: string }) {
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
        Open public page
      </Button>
      <Button
        size="small"
        startIcon={<LinkOutlined />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              new URL(`/e/${publicId}`, window.location.origin).href,
            );
            notifications.show("Link copied.", {
              severity: "success",
              key: "copy-event-link",
              autoHideDuration: 3000,
            });
          } catch {
            notifications.show(
              "Couldn’t copy the link. Open the public page and copy its address.",
              { severity: "error", key: "copy-event-link" },
            );
          }
        }}
      >
        Copy link
      </Button>
    </Stack>
  );
}
