"use client";

import { Chip } from "@mui/material";
import { useTranslations } from "next-intl";
import {
  type EventLanguage,
  eventLanguageNames,
} from "@/features/events/event-language";

export function EventLanguageChip({
  language,
  inverse = false,
}: {
  language: EventLanguage;
  inverse?: boolean;
}) {
  const t = useTranslations("events");

  return (
    <Chip
      size="small"
      variant="outlined"
      label={language.toUpperCase()}
      title={t("eventLanguageValue", {
        language: eventLanguageNames[language],
      })}
      aria-label={t("eventLanguageValue", {
        language: eventLanguageNames[language],
      })}
      sx={{
        color: inverse ? "#fff" : "text.primary",
        borderColor: "currentColor",
      }}
    />
  );
}
