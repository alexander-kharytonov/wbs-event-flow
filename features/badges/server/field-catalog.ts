import "server-only";
import {
  type BadgeField,
  type BadgeFieldContext,
  badgeFieldSchema,
  readBadgeLayout,
  sameBadgeField,
} from "@/features/badges/badge-layout";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import type { Prisma } from "@/generated/prisma/client";

export async function fieldCatalog(
  tx: Prisma.TransactionClient,
  eventId: string,
) {
  const fields: (BadgeField & BadgeFieldContext)[] = [];
  const add = (candidate: unknown, context: BadgeFieldContext) => {
    const parsed = badgeFieldSchema.safeParse(candidate);

    if (
      parsed.success &&
      !fields.some((field) => sameBadgeField(field, parsed.data))
    ) {
      fields.push({ ...parsed.data, ...context });
    }
  };
  const draft = await tx.registrationField.findMany({
    where: { form: { eventId } },
    orderBy: { position: "asc" },
    select: {
      id: true,
      position: true,
      type: true,
      label: true,
    },
  });

  for (const field of draft) {
    add(
      { fieldId: field.id, type: field.type, label: field.label },
      {
        context: "badgeCurrentQuestion",
        contextValues: { number: field.position + 1 },
      },
    );
  }

  // Preserve approved bindings even when an unpublished draft question is deleted.
  const saved = await tx.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { badgeLayout: true },
  });
  const savedLayout = readBadgeLayout(saved.badgeLayout);

  const revisions = await tx.eventRevision.findMany({
    where: { eventId },
    orderBy: { number: "desc" },
    select: {
      number: true,
      snapshot: true,
      applications: {
        where: { registrations: { some: { revokedAt: null } } },
        select: { id: true },
        take: 1,
      },
    },
  });

  for (const revision of revisions) {
    const parsed = eventSnapshotSchema.safeParse(revision.snapshot);

    if (parsed.success) {
      for (const [
        position,
        field,
      ] of parsed.data.registrationForm.fields.entries()) {
        add(
          { fieldId: field.id, type: field.type, label: field.label },
          {
            context: "badgePublishedQuestion",
            contextValues: {
              number: position + 1,
              revision: revision.number,
            },
          },
        );
      }
    }
  }

  if (savedLayout.success) {
    const { secondaryField, tertiaryField } = savedLayout.data;

    if (secondaryField) {
      add(secondaryField, { context: "badgeSavedSecondary" });
    }

    if (tertiaryField) {
      add(tertiaryField, { context: "badgeSavedTertiary" });
    }
  }

  return {
    fields,
    activeSnapshots: revisions
      .filter((revision) => revision.applications.length > 0)
      .map(({ snapshot }) => snapshot),
  };
}
