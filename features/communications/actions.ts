"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  previewManualMessage,
  sendManualMessage,
} from "@/features/communications/server/manual-service";
import { readCommunicationHistory } from "@/features/communications/server/read";
import { requireVerifiedUser } from "@/lib/session";

export async function previewMessage(input: unknown) {
  const user = await requireVerifiedUser();

  return previewManualMessage(user.id, input);
}

export async function queueMessage(input: unknown) {
  const user = await requireVerifiedUser();
  const result = await sendManualMessage(user.id, input);

  if (result.success) {
    revalidatePath("/dashboard/events/[id]/communications", "page");
  }

  return result;
}

export async function filterCommunicationHistory(input: unknown) {
  const parsed = z
    .strictObject({
      eventId: z.uuid(),
      subject: z.string().trim().max(400),
      kind: z.enum(["ALL", "MANUAL", "TRANSACTIONAL"]),
      before: z.uuid().optional(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { eventId, subject, kind, before } = parsed.data;
  const data = await readCommunicationHistory(eventId, before, {
    subject,
    kind: kind === "ALL" ? undefined : kind,
  });

  if (!data) {
    return null;
  }

  return {
    items: data.items,
    hasCursor: data.hasCursor,
    nextCursor: data.nextCursor,
  };
}
