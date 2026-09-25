import "server-only";
import type {
  BuilderForm,
  RegistrationResult,
} from "@/features/events/schemas/registration-form";
import { registrationMutationSchema } from "@/features/events/schemas/registration-form";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const formSelection = {
  updatedAt: true,
  fields: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      type: true,
      label: true,
      description: true,
      required: true,
      options: { orderBy: { position: "asc" }, select: { label: true } },
    },
  },
} satisfies Prisma.RegistrationFormSelect;

type SelectedForm = Prisma.RegistrationFormGetPayload<{
  select: typeof formSelection;
}>;

function serializeForm(form: SelectedForm): BuilderForm {
  return {
    version: form.updatedAt.toISOString(),
    fields: form.fields.map((field) => ({
      ...field,
      description: field.description ?? "",
    })),
  };
}

export async function getRegistrationForm(
  eventId: string,
  organizerId: string,
) {
  // Prisma loads relations with multiple queries; keep fields and version in one snapshot.
  return prisma.$transaction(
    async (tx) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, organizerId },
        select: {
          title: true,
          publishedAt: true,
          registrationForm: { select: formSelection },
        },
      });

      if (!event?.registrationForm) {
        return null;
      }

      return {
        title: event.title,
        published: event.publishedAt !== null,
        form: serializeForm(event.registrationForm),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

class FormMutationError extends Error {
  constructor(
    message: string,
    readonly conflict = false,
  ) {
    super(message);
  }
}

const unavailable = "This question or event is unavailable for editing.";

export async function mutateRegistrationForm(
  organizerId: string,
  input: unknown,
): Promise<RegistrationResult> {
  const parsed = registrationMutationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: parsed.error.issues.map((issue) => issue.message).join(" "),
    };
  }

  const command = parsed.data;

  try {
    const form = await prisma.$transaction(async (tx) => {
      // Lock the parent first so its ownership/publication cannot change during a write.
      const events = await tx.$queryRaw<
        { id: string; publishedAt: Date | null }[]
      >`
        SELECT "id", "publishedAt" FROM "Event"
        WHERE "id" = ${command.eventId} AND "organizerId" = ${organizerId}
        FOR UPDATE`;

      if (!events[0] || events[0].publishedAt !== null) {
        throw new FormMutationError(unavailable);
      }

      const forms = await tx.$queryRaw<{ id: string; updatedAt: Date }[]>`
        SELECT "id", "updatedAt" FROM "RegistrationForm"
        WHERE "eventId" = ${command.eventId} FOR UPDATE`;
      const current = forms[0];

      if (!current) {
        throw new FormMutationError(unavailable);
      }

      const fields = await tx.registrationField.findMany({
        where: { formId: current.id },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      const ids = fields.map((field) => field.id);

      // Resource membership is checked before reporting a version conflict.
      if (
        (command.kind === "edit" || command.kind === "delete") &&
        !ids.includes(command.fieldId)
      ) {
        throw new FormMutationError(unavailable);
      }

      if (
        command.kind === "reorder" &&
        (command.fieldIds.length !== ids.length ||
          new Set(command.fieldIds).size !== ids.length ||
          command.fieldIds.some((id) => !ids.includes(id)))
      ) {
        throw new FormMutationError(
          "The question order must contain every question exactly once.",
        );
      }

      if (current.updatedAt.toISOString() !== command.version) {
        throw new FormMutationError(
          "This form changed while you were editing it. Reload the latest version before trying again. Your changes have not been saved.",
          true,
        );
      }

      // Advance by at least 1 ms even for writes within the same clock tick.
      await tx.registrationForm.update({
        where: { id: current.id },
        data: {
          updatedAt: new Date(
            Math.max(Date.now(), current.updatedAt.getTime() + 1),
          ),
        },
      });

      if (command.kind === "add" || command.kind === "edit") {
        const { options, description, ...field } = command.field;
        const data = {
          ...field,
          description: description || null,
          options: {
            create: (options ?? []).map((option, position) => ({
              label: option.label,
              position,
            })),
          },
        };

        if (command.kind === "add") {
          await tx.registrationField.create({
            data: { ...data, formId: current.id, position: ids.length },
          });
        } else {
          // Options have no external references in this iteration: replace the full ordered list.
          await tx.registrationFieldOption.deleteMany({
            where: { fieldId: command.fieldId },
          });
          await tx.registrationField.update({
            where: { id: command.fieldId },
            data,
          });
        }
      }

      if (command.kind === "delete") {
        await tx.registrationField.delete({ where: { id: command.fieldId } });
      }

      if (command.kind === "delete" || command.kind === "reorder") {
        const ordered =
          command.kind === "reorder"
            ? command.fieldIds
            : ids.filter((id) => id !== command.fieldId);
        // Move to disjoint negative positions first, avoiding the immediate unique constraint.
        for (const [position, id] of ordered.entries()) {
          await tx.registrationField.update({
            where: { id },
            data: { position: -position - 1 },
          });
        }

        for (const [position, id] of ordered.entries()) {
          await tx.registrationField.update({
            where: { id },
            data: { position },
          });
        }
      }

      return serializeForm(
        await tx.registrationForm.findUniqueOrThrow({
          where: { id: current.id },
          select: formSelection,
        }),
      );
    });

    return { form };
  } catch (error) {
    if (error instanceof FormMutationError) {
      return { message: error.message, conflict: error.conflict };
    }

    return { message: "We couldn’t save the form. Please try again." };
  }
}
