"use client";

import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PendingOutlined from "@mui/icons-material/PendingOutlined";
import { useTranslations } from "next-intl";
import { EventStatusChip } from "@/features/events/components/event-status-chip";
import type { publicationState } from "@/features/events/publication-state";

export function PublicationStatus({
  state,
}: {
  state: ReturnType<typeof publicationState>;
}) {
  const t = useTranslations("events");
  const color =
    state === "Published" ? "success" : state === "Draft" ? "info" : "warning";
  const Icon =
    state === "Published"
      ? CheckCircleOutlined
      : state === "Draft"
        ? EditOutlined
        : PendingOutlined;

  return (
    <EventStatusChip
      label={t(
        (
          {
            Published: "published",
            Draft: "draft",
            Unpublished: "unpublished",
            "Unpublished changes": "unpublishedChanges",
          } as const
        )[state],
      )}
      icon={<Icon />}
      color={color}
    />
  );
}
