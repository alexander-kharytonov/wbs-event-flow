"use client";

import LayersOutlined from "@mui/icons-material/LayersOutlined";
import { useTranslations } from "next-intl";
import { EventStatusChip } from "@/features/events/components/event-status-chip";

export function PublishedVersion({ number }: { number: number }) {
  const t = useTranslations("events");

  return (
    <EventStatusChip
      icon={<LayersOutlined />}
      label={t("publishedVersionNumber", { number })}
      color="default"
    />
  );
}
