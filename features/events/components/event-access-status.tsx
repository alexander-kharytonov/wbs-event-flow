"use client";

import BadgeOutlined from "@mui/icons-material/BadgeOutlined";
import { EventStatusChip } from "@/features/events/components/event-status-chip";
import { accessLabels } from "@/features/events/event-access-labels";

export function EventAccessStatus({
  role,
}: {
  role: keyof typeof accessLabels;
}) {
  return (
    <EventStatusChip
      icon={<BadgeOutlined />}
      color="default"
      label={accessLabels[role]}
    />
  );
}
