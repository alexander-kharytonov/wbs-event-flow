"use client";

import { type TranslationValues, useTranslations } from "next-intl";
import type { Messages } from "@/lib/i18n/messages";

export function EventText({
  id,
  values,
}: {
  id: keyof Messages["events"];
  values?: TranslationValues;
}) {
  const t = useTranslations("events");

  return t(id, values);
}
