"use client";

import { MenuItem, TextField } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import {
  type EventLanguage,
  eventLanguageNames,
  eventLanguages,
} from "@/features/events/event-language";

export function CatalogLanguageFilter({
  language,
}: {
  language?: EventLanguage;
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <TextField
      select
      label={t("eventLanguage")}
      value={language ?? "ALL"}
      disabled={pending}
      sx={{ minWidth: 0 }}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());

        if (event.target.value !== "ALL") {
          params.set("language", event.target.value);
        } else {
          params.delete("language");
        }
        const query = params.toString();
        startTransition(() => {
          router.push(query ? `${pathname}?${query}` : pathname, {
            scroll: false,
          });
        });
      }}
    >
      <MenuItem value="ALL">{t("allLanguages")}</MenuItem>
      {eventLanguages.map((value) => (
        <MenuItem key={value} value={value}>
          {value.toUpperCase()} — {eventLanguageNames[value]}
        </MenuItem>
      ))}
    </TextField>
  );
}
