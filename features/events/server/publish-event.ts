import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const workspaceInclude = {
  publishedRevision: { select: { contentVersion: true, number: true } },
  registrationForm: {
    include: {
      fields: {
        orderBy: { position: "asc" },
        include: { options: { orderBy: { position: "asc" } } },
      },
    },
  },
} satisfies Prisma.EventInclude;

const publishInput = z.strictObject({
  eventId: z.string().min(1),
  contentVersion: z.number().int().positive(),
});

export type PublishResult = {
  message?: string;
  conflict?: boolean;
  success?: boolean;
};

export async function publishOwnedEvent(
  organizerId: string,
  input: unknown,
): Promise<PublishResult> {
  const parsed = publishInput.safeParse(input);

  if (!parsed.success) {
    return { message: "Reload the event before publishing." };
  }

  const { eventId, contentVersion } = parsed.data;

  try {
    return await prisma.$transaction(async (tx) => {
      // All form writes lock Event first. Event edits acquire the same row lock.
      // Lock before loading relations, so every snapshot query sees one workspace.
      const owned = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Event"
        WHERE "id" = ${eventId} AND "organizerId" = ${organizerId}
        FOR UPDATE`;

      if (!owned[0]) {
        return { message: "This event is unavailable for publishing." };
      }

      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        include: workspaceInclude,
      });

      if (event.contentVersion !== contentVersion) {
        return {
          conflict: true,
          message:
            "The workspace changed. Review the latest version before publishing.",
        };
      }

      if (event.publishedRevision?.contentVersion === contentVersion) {
        return { success: true };
      }

      if (!event.registrationForm) {
        return { message: "The registration form is unavailable." };
      }

      const snapshot = eventSnapshotSchema.safeParse({
        schemaVersion: 1,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        timezone: event.timezone,
        visibility: event.visibility,
        accountRequirement: event.accountRequirement,
        capacity: event.capacity,
        registrationOpensAt: event.registrationOpensAt?.toISOString() ?? null,
        registrationClosesAt: event.registrationClosesAt?.toISOString() ?? null,
        registrationForm: {
          fields: event.registrationForm.fields.map((field) => ({
            id: field.id,
            type: field.type,
            label: field.label,
            description: field.description,
            required: field.required,
            options: field.options.map(({ id, label }) => ({ id, label })),
          })),
        },
      });

      if (!snapshot.success) {
        return {
          message:
            "Check the event details and registration questions before publishing.",
        };
      }

      const latest = await tx.eventRevision.findFirst({
        where: { eventId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const now = new Date();
      const revision = await tx.eventRevision.create({
        data: {
          eventId,
          number: (latest?.number ?? 0) + 1,
          contentVersion,
          snapshot: snapshot.data,
          publishedAt: now,
        },
      });
      await tx.event.update({
        where: { id: eventId },
        data: {
          publishedRevisionId: revision.id,
          publicId: event.publicId ?? randomBytes(24).toString("base64url"),
          publishedAt: event.publishedAt ?? now,
          // Publication is not a workspace edit; preserve its concurrency token.
          updatedAt: event.updatedAt,
        },
      });

      return { success: true };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return {
        conflict: true,
        message:
          "The event changed during publication. Reload and review the latest version.",
      };
    }

    return { message: "We couldn’t publish the event. Please try again." };
  }
}
