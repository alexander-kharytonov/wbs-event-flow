import "server-only";
import { z } from "zod";
import {
  type BadgeField,
  type BadgeLayout,
  badgeFieldSchema,
  badgeLayoutSchema,
  readBadgeLayout,
  sameBadgeField,
} from "@/features/badges/badge-layout";
import {
  attendeeBadgePresentation,
  type BadgeIssue,
  type BadgePresentation,
  badgeText,
} from "@/features/badges/badge-presentation";
import { resolveBadgeField } from "@/features/badges/server/historical-field";
import { canPrintIndividualBadge } from "@/features/badges/server/individual-print-eligibility";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import {
  authorizeEventActor,
  hasEventPermission,
} from "@/features/events/server/event-access";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import {
  ticketDisplaySelect,
  ticketQrDataUrl,
} from "@/features/tickets/server/ticket-display";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const selectorSchema = z.strictObject({
  eventId: z.uuid(),
  attendeeId: z.uuid().optional(),
});
const saveSchema = z.strictObject({
  eventId: z.uuid(),
  layout: badgeLayoutSchema,
});

async function fieldCatalog(tx: Prisma.TransactionClient, eventId: string) {
  const fields: (BadgeField & { context: string })[] = [];
  const add = (candidate: unknown, context: string) => {
    const parsed = badgeFieldSchema.safeParse(candidate);

    if (
      parsed.success &&
      !fields.some((field) => sameBadgeField(field, parsed.data))
    ) {
      fields.push({ ...parsed.data, context });
    }
  };
  const draft = await tx.registrationField.findMany({
    where: { form: { eventId } },
    orderBy: { position: "asc" },
    select: { id: true, type: true, label: true },
  });

  for (const [position, field] of draft.entries()) {
    add(
      { fieldId: field.id, type: field.type, label: field.label },
      `Current form · Question ${position + 1}`,
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
          `Published version ${revision.number} · Question ${position + 1}`,
        );
      }
    }
  }

  if (savedLayout.success) {
    const { secondaryField, tertiaryField } = savedLayout.data;

    if (secondaryField) {
      add(secondaryField, "Saved secondary field");
    }

    if (tertiaryField) {
      add(tertiaryField, "Saved tertiary field");
    }
  }

  return {
    fields,
    activeSnapshots: revisions
      .filter((revision) => revision.applications.length > 0)
      .map(({ snapshot }) => snapshot),
  };
}

function validBindings(layout: BadgeLayout, fields: BadgeField[]) {
  return [layout.secondaryField, layout.tertiaryField].every(
    (binding) =>
      !binding || fields.some((field) => sameBadgeField(field, binding)),
  );
}

// Authenticated actor identity comes from the server session adapter, never client input.
// A draft layout is accepted only by the owner-authorized preview path.
export async function buildBadgePresentation(
  actor: { userId: string },
  input: unknown,
  options: { mode: "PRINT" | "PREVIEW"; draftLayout?: unknown },
) {
  const selector = selectorSchema.safeParse(input);

  if (
    !selector.success ||
    (options.mode === "PRINT" &&
      (!selector.data.attendeeId || options.draftLayout !== undefined))
  ) {
    return null;
  }

  return prisma.$transaction(
    async (tx) => {
      const { eventId, attendeeId } = selector.data;
      const access = await authorizeEventActor(
        tx,
        eventId,
        actor.userId,
        options.mode === "PREVIEW"
          ? "badges.print.bulk"
          : "badges.print.individual",
      );

      if (!access) {
        return null;
      }

      const configure = hasEventPermission(access.role, "badges.configure");

      if (options.draftLayout !== undefined && !configure) {
        return null;
      }

      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { id: true, title: true, cancelledAt: true, badgeLayout: true },
      });
      const parsed =
        options.draftLayout === undefined
          ? readBadgeLayout(event.badgeLayout)
          : badgeLayoutSchema.safeParse(options.draftLayout);

      if (!parsed.success) {
        return null;
      }

      const layout = parsed.data;
      const catalog =
        configure && options.mode === "PREVIEW"
          ? await fieldCatalog(tx, eventId)
          : null;

      if (catalog && !validBindings(layout, catalog.fields)) {
        return null;
      }

      const person = await tx.attendee.findFirst({
        where: {
          ...(attendeeId ? { id: attendeeId } : {}),
          revokedAt: null,
          registration: { eventId, revokedAt: null },
        },
        // Prisma enum declaration order puts PRIMARY before GUEST.
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          kind: true,
          revokedAt: true,
          registration: {
            select: {
              sourceApplicationId: true,
              eventId: true,
              revokedAt: true,
            },
          },
        },
      });

      if (!person && (options.mode === "PRINT" || attendeeId)) {
        return null;
      }

      const canPrint = Boolean(
        person && canPrintIndividualBadge(access.role, event, person),
      );

      if (options.mode === "PRINT" && !canPrint) {
        return null;
      }

      const presentation: BadgePresentation = attendeeBadgePresentation(
        layout,
        person ?? { name: "Attendee name", kind: "PRIMARY" },
        event.title,
      );
      presentation.qrPlaceholder = options.mode === "PREVIEW" && layout.showQr;
      const issues: BadgeIssue[] = [];

      if (!person) {
        presentation.secondary = layout.secondaryField
          ? badgeText(layout.secondaryField.label)
          : null;
        presentation.tertiary = layout.tertiaryField
          ? badgeText(layout.tertiaryField.label)
          : null;
      } else if (
        person.kind === "PRIMARY" &&
        (layout.secondaryField || layout.tertiaryField)
      ) {
        const application = await tx.application.findUniqueOrThrow({
          where: { id: person.registration.sourceApplicationId },
          select: {
            eventRevision: { select: { snapshot: true } },
            answers: {
              where: {
                fieldId: {
                  in: [
                    layout.secondaryField?.fieldId,
                    layout.tertiaryField?.fieldId,
                  ].filter((id): id is string => Boolean(id)),
                },
              },
              select: {
                fieldId: true,
                textValue: true,
                booleanValue: true,
                selectedOptions: { select: { optionId: true } },
              },
            },
          },
        });

        for (const slot of ["secondary", "tertiary"] as const) {
          const binding =
            slot === "secondary" ? layout.secondaryField : layout.tertiaryField;

          if (!binding) {
            continue;
          }

          const resolved = resolveBadgeField(
            binding,
            application.eventRevision.snapshot,
            application.answers,
          );

          if (resolved.status === "VALUE") {
            presentation[slot] = resolved.value;
          } else if (
            configure &&
            (resolved.status === "INCOMPATIBLE" ||
              resolved.status === "UNAVAILABLE")
          ) {
            issues.push({ slot, reason: resolved.status });
          }
        }
      }

      if (
        person &&
        !event.cancelledAt &&
        (layout.showQr || layout.showTicketNumber)
      ) {
        const ticket = await tx.ticket.findUnique({
          where: { attendeeId: person.id },
          select: ticketDisplaySelect,
        });

        if (ticket && !ticket.revokedAt) {
          try {
            // Preview never decrypts or exposes an admission QR.
            if (layout.showQr && options.mode === "PRINT") {
              presentation.qrDataUrl = await ticketQrDataUrl(ticket);
            }

            presentation.ticketNumber = layout.showTicketNumber
              ? ticket.number
              : null;
          } catch {
            // An unavailable credential must not prevent a visual badge or leak crypto errors.
            presentation.qrDataUrl = null;
            presentation.ticketNumber = null;
          }
        } else {
          presentation.qrPlaceholder = false;
        }
      }

      const bindingWarnings: BadgeIssue[] = [];

      if (catalog) {
        for (const slot of ["secondary", "tertiary"] as const) {
          const binding =
            slot === "secondary" ? layout.secondaryField : layout.tertiaryField;

          if (!binding) {
            continue;
          }

          for (const snapshot of catalog.activeSnapshots) {
            const result = resolveBadgeField(binding, snapshot, []);

            if (
              result.status === "INCOMPATIBLE" ||
              result.status === "UNAVAILABLE"
            ) {
              bindingWarnings.push({ slot, reason: result.status });
              break;
            }
          }
        }
      }

      return {
        presentation,
        attendeeId: person?.id ?? null,
        canPrint,
        // Reception gets neither config references nor catalog/issues about Applications.
        ...(options.mode === "PREVIEW"
          ? {
              editor: configure
                ? {
                    layout,
                    fields: catalog?.fields ?? [],
                    issues,
                    bindingWarnings,
                  }
                : null,
            }
          : {}),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function saveBadgeLayout(
  actor: { userId: string },
  input: unknown,
) {
  const parsed = saveSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the badge settings and try again.",
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
      return { success: false, message: "This event is unavailable." };
    }

    const catalog = await fieldCatalog(tx, event.id);

    if (!validBindings(parsed.data.layout, catalog.fields)) {
      return {
        success: false,
        message:
          "A selected question is unavailable. Reload the badge designer.",
      };
    }

    await tx.event.update({
      where: { id: event.id },
      data: { badgeLayout: parsed.data.layout, updatedAt: event.updatedAt },
    });

    return {
      success: true,
      message: "Badge layout saved. New print documents use these settings.",
    };
  });
}
