"use client";

import { useTranslations } from "next-intl";
import type { Messages } from "@/lib/i18n/messages";

export function AuthText({ id }: { id: keyof Messages["auth"] }) {
  const t = useTranslations("auth");

  return t(id);
}
