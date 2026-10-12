import "server-only";
import { createTranslator } from "use-intl/core";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";
import { loadMessages } from "@/lib/i18n/messages";

export async function getRegistrationSelectPlaceholders(
  language: EventSnapshot["language"],
) {
  // Load Event-language dictionaries explicitly; request messages use the UI locale.
  const t = createTranslator({
    locale: language,
    messages: await loadMessages(language),
    namespace: "events",
  });

  return { chooseOption: t("chooseOption"), noSelection: t("noSelection") };
}
