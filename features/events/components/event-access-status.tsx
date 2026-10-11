"use client";

import BadgeOutlined from "@mui/icons-material/BadgeOutlined";
import { useTranslations } from "next-intl";
import { EventStatusChip } from "@/features/events/components/event-status-chip";
import type { accessLabels } from "@/features/events/event-access-labels";

export function EventAccessStatus({
  role,
}: {
  role: keyof typeof accessLabels;
}) {
  const t = useTranslations("events");

  return (
    <EventStatusChip
      icon={<BadgeOutlined />}
      color="default"
      label={t(
        (
          {
            OWNER: "owner",
            MANAGER: "manager",
            RECEPTION: "reception",
          } as const
        )[role],
      )}
    />
  );
}
