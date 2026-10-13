import "server-only";
import { z } from "zod";
import {
  badgeLayoutSchema,
  validBadgeBindings,
} from "@/features/badges/badge-layout";
import { fieldCatalog } from "@/features/badges/server/field-catalog";
import { writeBadgeLayout } from "@/features/badges/server/write-badge-layout";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { prisma } from "@/lib/prisma";

const saveSchema = z.strictObject({
  eventId: z.uuid(),
  layout: badgeLayoutSchema,
});

export async function saveBadgeLayout(
  actor: { userId: string },
  input: unknown,
) {
  const parsed = saveSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "badgeCheckSettings",
    };
  }

  return prisma.$transaction(async (tx) => {
    const event = await lockEventForUpdate(tx, { id: parsed.data.eventId });
    const access =
      event &&
      (await authorizeEventActor(
        tx,
        event.id,
        actor.userId,
        "badges.configure",
      ));

    if (!event || !access) {
      return { success: false, message: "badgeEventUnavailable" };
    }

    const catalog = await fieldCatalog(tx, event.id);

    if (!validBadgeBindings(parsed.data.layout, catalog.fields)) {
      return {
        success: false,
        message:
          "A selected question is unavailable. Reload the badge designer.",
      };
    }

    await writeBadgeLayout(
      tx,
      event.id,
      parsed.data.layout,
      catalog.fields,
      event.updatedAt,
    );

    return {
      success: true,
      message: "badgeLayoutSaved",
    };
  });
}
