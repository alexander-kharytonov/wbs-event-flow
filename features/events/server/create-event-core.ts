import "server-only";
import type { z } from "zod";
import {
  type BadgeField,
  badgeFieldSchema,
} from "@/features/badges/badge-layout";
import { writeBadgeLayout } from "@/features/badges/server/write-badge-layout";
import type { eventInputSchema } from "@/features/events/event-input-schema";
import type { TemplateEvent } from "@/features/events/import/template-input";
import {
  isChoice,
  registrationFieldData,
} from "@/features/events/schemas/registration-form";
import type { StaffInput } from "@/features/events/staff-input";
import type { Prisma } from "@/generated/prisma/client";

type EventConfiguration = z.output<typeof eventInputSchema>;

// Authorization and validation belong to the server adapter. All writes use its tx.
export async function createEventCore(
  tx: Prisma.TransactionClient,
  organizerId: string,
  configuration: EventConfiguration,
  fields: TemplateEvent["registrationForm"]["fields"] = [],
  badgeLayout: TemplateEvent["badgeLayout"] = null,
  staff: { userId: string; role: StaffInput["role"] }[] = [],
) {
  const event = await tx.event.create({
    data: {
      organizerId,
      title: configuration.title,
      description: configuration.description,
      startsAt: configuration.startsAt,
      endsAt: configuration.endsAt,
      timezone: configuration.timezone,
      visibility: configuration.visibility,
      accountRequirement: configuration.accountRequirement,
      capacity: configuration.capacity,
      maxGuestsPerRegistration: configuration.maxGuestsPerRegistration,
      registrationOpensAt: configuration.registrationOpensAt,
      registrationClosesAt: configuration.registrationClosesAt,
      publishedAt: null,
      registrationForm: { create: {} },
    },
    select: {
      id: true,
      updatedAt: true,
      registrationForm: { select: { id: true } },
    },
  });
  const formId = event.registrationForm?.id;

  if (!formId) {
    throw new Error("Missing registration form.");
  }

  const normalized = fields.map((field) =>
    registrationFieldData({
      type: field.type,
      label: field.label,
      description: field.description ?? "",
      required: field.required,
      ...(isChoice(field.type) ? { options: field.options } : {}),
    }),
  );
  const created = fields.length
    ? await tx.registrationField.createManyAndReturn({
        data: normalized.map((field, position) => ({
          formId,
          position,
          type: field.type,
          label: field.label,
          description: field.description,
          required: field.required,
        })),
        select: { id: true, position: true, type: true, label: true },
      })
    : [];
  const byPosition = new Map(created.map((field) => [field.position, field]));
  const byKey = new Map<string, (typeof created)[number]>();
  const options: Prisma.RegistrationFieldOptionCreateManyInput[] = [];

  for (const [position, field] of fields.entries()) {
    const row = byPosition.get(position);

    if (!row || byKey.has(field.key)) {
      throw new Error("Invalid field identity map.");
    }

    byKey.set(field.key, row);

    for (const option of normalized[position].options) {
      options.push({
        fieldId: row.id,
        label: option.label,
        position: option.position,
      });
    }
  }

  if (options.length) {
    await tx.registrationFieldOption.createMany({ data: options });
  }

  if (badgeLayout) {
    const remap = (binding: typeof badgeLayout.secondaryField) => {
      if (!binding) {
        return null;
      }

      const field = byKey.get(binding.fieldKey);

      if (
        !field ||
        field.type !== binding.type ||
        field.label !== binding.label
      ) {
        throw new Error("Invalid portable badge binding.");
      }

      return { fieldId: field.id, type: binding.type, label: binding.label };
    };
    const catalog: BadgeField[] = [];

    for (const field of created) {
      const candidate = badgeFieldSchema.safeParse({
        fieldId: field.id,
        type: field.type,
        label: field.label,
      });

      if (candidate.success) {
        catalog.push(candidate.data);
      }
    }

    await writeBadgeLayout(
      tx,
      event.id,
      {
        ...badgeLayout,
        secondaryField: remap(badgeLayout.secondaryField),
        tertiaryField: remap(badgeLayout.tertiaryField),
      },
      catalog,
      event.updatedAt,
    );
  }

  if (staff.length) {
    await tx.eventStaff.createMany({
      data: staff.map((member) => ({
        eventId: event.id,
        userId: member.userId,
        role: member.role,
      })),
    });
  }

  return event.id;
}
