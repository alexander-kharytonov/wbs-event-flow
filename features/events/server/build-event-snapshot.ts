import "server-only";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import type { Prisma } from "@/generated/prisma/client";

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

type EventWorkspace = Prisma.EventGetPayload<{
  include: typeof workspaceInclude;
}>;

export function buildEventSnapshot(event: EventWorkspace) {
  return eventSnapshotSchema.safeParse({
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
      fields: event.registrationForm?.fields
        .toSorted((a, b) => a.position - b.position)
        .map((field) => ({
          id: field.id,
          type: field.type,
          label: field.label,
          description: field.description,
          required: field.required,
          options: field.options
            .toSorted((a, b) => a.position - b.position)
            .map(({ id, label }) => ({ id, label })),
        })),
    },
  });
}
