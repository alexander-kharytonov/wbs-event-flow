import "server-only";
import { z } from "zod";
import { workspaceReadOnly } from "@/features/events/event-lifecycle";
import type {
  BuilderForm,
  RegistrationResult,
} from "@/features/events/schemas/registration-form";
import {
  registrationFieldData,
  registrationFieldIssue,
  registrationMutationSchema,
} from "@/features/events/schemas/registration-form";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import type { Prisma } from "@/generated/prisma/client";
import type { Messages } from "@/lib/i18n/messages";
import { prisma } from "@/lib/prisma";

const formSelection = (subject: "APPLICANT" | "GUEST") =>
  ({
    updatedAt: true,
    fields: {
      where: { subject },
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
  }) satisfies Prisma.RegistrationFormSelect;

type SelectedForm = Prisma.RegistrationFormGetPayload<{
  select: ReturnType<typeof formSelection>;
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
  subject: "APPLICANT" | "GUEST" = "APPLICANT",
) {
  if (!z.uuid().safeParse(eventId).success) {
    return null;
  }

  // Prisma loads relations with multiple queries; keep fields and version in one snapshot.
  return prisma.$transaction(
    async (tx) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, organizerId },
        select: {
          startsAt: true,
          endsAt: true,
          cancelledAt: true,
          cancellationReason: true,
          archivedAt: true,
          title: true,
          _count: {
            select: {
              applications: true,
              revisions: true,
            },
          },
          publicId: true,
          publishedAt: true,
          contentVersion: true,
          publishedRevision: {
            select: { contentVersion: true, number: true, snapshot: true },
          },
          registrationForm: { select: formSelection(subject) },
        },
      });

      if (!event?.registrationForm) {
        return null;
      }

      return {
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        cancelledAt: event.cancelledAt,
        cancellationReason: event.cancellationReason,
        archivedAt: event.archivedAt,
        title: event.title,
        applicationCount: event._count.applications,
        attendeeCount: await tx.attendee.count({
          where: { registration: { eventId }, revokedAt: null },
        }),
        publicId: event.publicId,
        publishedAt: event.publishedAt,
        _count: event._count,
        contentVersion: event.contentVersion,
        publishedRevision: event.publishedRevision,
        form: serializeForm(event.registrationForm),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

class FormMutationError extends Error {
  constructor(
    readonly code: keyof Messages["events"],
    readonly conflict = false,
  ) {
    super(code);
  }
}

const unavailable = "questionUnavailable";

export async function mutateRegistrationForm(
  organizerId: string,
  input: unknown,
  subject: "APPLICANT" | "GUEST" = "APPLICANT",
): Promise<RegistrationResult> {
  const parsed = registrationMutationSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      parsed.error.issues
        .filter((issue) => issue.path[0] === "field")
        .map((issue) => [
          issue.path.slice(1).join("."),
          registrationFieldIssue(issue),
        ]),
    );

    return {
      message: "questionCheck",
      ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
    };
  }

  const command = parsed.data;

  try {
    const form = await prisma.$transaction(async (tx) => {
      // Lock the parent first, serializing form mutations with publication.
      const locked = await lockEventForUpdate(tx, {
        id: command.eventId,
        organizerId,
      });

      if (!locked || workspaceReadOnly(locked, locked.decisionNow)) {
        throw new FormMutationError("mediaReadOnly");
      }

      if (subject === "GUEST" && locked.guestPolicy !== "APPROVAL_REQUIRED") {
        throw new FormMutationError(unavailable);
      }

      const forms = await tx.$queryRaw<{ id: string; updatedAt: Date }[]>`
        SELECT "id", "updatedAt" FROM "RegistrationForm"
        WHERE "eventId" = ${command.eventId}::uuid FOR UPDATE`;
      const current = forms[0];

      if (!current) {
        throw new FormMutationError(unavailable);
      }

      const fields = await tx.registrationField.findMany({
        where: { formId: current.id, subject },
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
        throw new FormMutationError("questionOrderInvalid");
      }

      if (current.updatedAt.toISOString() !== command.version) {
        throw new FormMutationError("questionConflict", true);
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
        const { options, ...field } = registrationFieldData(command.field);
        const data = { ...field, options: { create: options } };

        if (command.kind === "add") {
          await tx.registrationField.create({
            data: {
              ...data,
              formId: current.id,
              subject,
              position: ids.length,
            },
          });
        } else {
          // Replace workspace options; published snapshots retain their original IDs.
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

      await tx.event.update({
        where: { id: command.eventId },
        data: {
          contentVersion: { increment: 1 },
          updatedAt: locked.updatedAt,
        },
      });

      return serializeForm(
        await tx.registrationForm.findUniqueOrThrow({
          where: { id: current.id },
          select: formSelection(subject),
        }),
      );
    });

    return { form };
  } catch (error) {
    if (error instanceof FormMutationError) {
      return { message: error.code, conflict: error.conflict };
    }

    return { message: "questionSaveFailed" };
  }
}
