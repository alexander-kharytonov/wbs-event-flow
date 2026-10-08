import "server-only";
import {
  manualAudienceSchema,
  manualContentSchema,
  manualContextSchema,
} from "@/features/communications/server/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { renderEmailTemplate } from "@/lib/email-template";

export function renderManualCommunication(input: {
  kind: string;
  subject: string;
  message: string | null;
  audience: unknown;
  contextSnapshot: unknown;
}) {
  if (input.kind !== "MANUAL") {
    throw new Error("Manual delivery requires a manual Communication.");
  }

  manualAudienceSchema.parse(input.audience);
  const content = manualContentSchema.parse({
    subject: input.subject,
    message: input.message,
  });
  const context = manualContextSchema.parse(input.contextSnapshot);

  return {
    subject: content.subject,
    ...renderEmailTemplate({
      title: content.subject,
      greeting: "Hello,",
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

  return renderManualCommunication(communication);
}
