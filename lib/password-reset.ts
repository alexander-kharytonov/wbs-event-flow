import "server-only";
import { after } from "next/server";
import { renderEmailTemplate } from "@/lib/email-template";
import { getServerEnv } from "@/lib/env";
import { createBackgroundTranslator } from "@/lib/i18n/background";
import type { UiLocale } from "@/lib/i18n/locale";
import { sendMail } from "@/lib/mail";

export async function sendPasswordResetEmail(
  { user, token }: { user: { email: string }; token: string },
  locale: UiLocale,
) {
  const link = new URL("/reset-password", getServerEnv().BETTER_AUTH_URL);
  link.hash = token;

  // Start immediately after the neutral response. SMTP/provider latency and
  // delivery failure must not reveal whether the submitted account exists.
  // This auth email has no Event/Communication and must not enter their outbox.
  after(async () => {
    try {
      const t = await createBackgroundTranslator(locale);
      const message = renderEmailTemplate({
        locale,
        title: t("email.resetTitle"),
        greeting: t("email.greeting"),
        introduction: t("email.resetIntro"),
        detailText: t("email.resetExpiry", { minutes: 30 }),
        action: { label: t("email.resetTitle"), url: link.href },
      });
      await sendMail({
        from: "Event Flow <notifications@eventflow.today>",
        to: user.email,
        subject: t("email.resetSubject"),
        ...message,
      });
    } catch {
      // Never log the error object, address, request, or bearer URL.
      console.error("Password recovery email delivery failed.");
    }
  });
}
