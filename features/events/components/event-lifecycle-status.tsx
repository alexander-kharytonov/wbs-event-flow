"use client";

import ArchiveOutlined from "@mui/icons-material/ArchiveOutlined";
import BlockOutlined from "@mui/icons-material/BlockOutlined";
import PlayCircleOutlined from "@mui/icons-material/PlayCircleOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import TaskAlt from "@mui/icons-material/TaskAlt";
import { Stack } from "@mui/material";
import { useTranslations } from "next-intl";
import { EventStatusChip } from "@/features/events/components/event-status-chip";
import {
  type EventLifecycleData,
  eventLifecycle,
} from "@/features/events/event-lifecycle";

export function EventLifecycleStatus({
  event,
  now,
}: {
  event: EventLifecycleData;
  now: Date;
}) {
  const t = useTranslations("events");
  const lifecycle = eventLifecycle(event, now);
  const Icon =
    lifecycle === "Cancelled"
      ? BlockOutlined
      : lifecycle === "Ongoing"
        ? PlayCircleOutlined
        : lifecycle === "Completed"
          ? TaskAlt
          : ScheduleOutlined;

  return (
    <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
      <EventStatusChip
        icon={<Icon />}
        label={t(
          (
            {
              Cancelled: "cancelled",
              Ongoing: "ongoing",
              Completed: "completed",
              Upcoming: "upcoming",
            } as const
          )[lifecycle],
        )}
        color={
          lifecycle === "Cancelled"
            ? "error"
            : lifecycle === "Ongoing"
              ? "success"
              : lifecycle === "Completed"
                ? "default"
                : "info"
        }
      />
      {event.archivedAt && (
        <EventStatusChip
          icon={<ArchiveOutlined />}
          label={t("archived")}
          color="default"
        />
      )}
    </Stack>
  );
}
