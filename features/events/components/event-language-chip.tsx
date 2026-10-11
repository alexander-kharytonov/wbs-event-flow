import { Chip } from "@mui/material";
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
  return (
    <Chip
      size="small"
      variant="outlined"
      label={language.toUpperCase()}
      title={`Event language: ${eventLanguageNames[language]}`}
      aria-label={`Event language: ${eventLanguageNames[language]}`}
      sx={{
        color: inverse ? "#fff" : "text.primary",
        borderColor: "currentColor",
      }}
    />
  );
}
