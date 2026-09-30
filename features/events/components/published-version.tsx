"use client";

import LayersOutlined from "@mui/icons-material/LayersOutlined";
import { EventStatusChip } from "@/features/events/components/event-status-chip";

export function PublishedVersion({ number }: { number: number }) {
  return (
    <EventStatusChip
      icon={<LayersOutlined />}
      label={`Published version ${number}`}
      color="default"
    />
  );
}
