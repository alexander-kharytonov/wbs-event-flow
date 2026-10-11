"use client";

import { useTranslations } from "next-intl";
import type { Messages } from "@/lib/i18n/messages";

export function ShellText({ id }: { id: keyof Messages["shell"] }) {
  const t = useTranslations("shell");

  return t(id);
}
