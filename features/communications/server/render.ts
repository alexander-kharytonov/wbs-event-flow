import "server-only";
import {
  manualAudienceSchema,
  manualContentSchema,
  manualContextSchema,
} from "@/features/communications/server/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { renderEmailTemplate } from "@/lib/email-template";
import { createBackgroundTranslator } from "@/lib/i18n/background";
import type { UiLocale } from "@/lib/i18n/locale";

export async function renderManualCommunication(
  input: {
    kind: string;
    subject: string;
    message: string | null;
    audience: unknown;
    contextSnapshot: unknown;
  },
  locale: UiLocale,
) {
  if (input.kind !== "MANUAL") {
    throw new Error("Manual delivery requires a manual Communication.");
  }

  manualAudienceSchema.parse(input.audience);
  const content = manualContentSchema.parse({
    subject: input.subject,
    message: input.message,
  });
  const context = manualContextSchema.parse(input.contextSnapshot);

  const t = await createBackgroundTranslator(locale);

  return {
    subject: content.subject,
    ...renderEmailTemplate({
      locale,
      title: content.subject,
      greeting: t("email.greeting"),
      introduction: content.message,
      detailTitle: context.eventTitle,
      preserveIntroductionNewlines: true,
    }),
  };
}

// Explicit narrow DB dependency also permits rollback-only delivery verification.
export async function loadManualCommunicationEmail(
  db: Pick<Prisma.TransactionClient, "communication">,
  communicationId: string,
  locale: UiLocale,
) {
  const communication = await db.communication.findUniqueOrThrow({
    where: { id: communicationId },
    select: {
      kind: true,
      subject: true,
      message: true,
      audience: true,
      contextSnapshot: true,
    },
  });

  return renderManualCommunication(communication, locale);
}
