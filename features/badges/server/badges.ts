import "server-only";
import { createTranslator } from "use-intl/core";
import { z } from "zod";
import {
  badgeLayoutSchema,
  readBadgeLayout,
  sameBadgeField,
  validBadgeBindings,
} from "@/features/badges/badge-layout";
import {
  attendeeBadgePresentation,
  type BadgeIssue,
  type BadgePresentation,
  badgeText,
} from "@/features/badges/badge-presentation";
import { badgeLabels } from "@/features/badges/components/badge";
import { fieldCatalog } from "@/features/badges/server/field-catalog";
import { resolveBadgeField } from "@/features/badges/server/historical-field";
import { canPrintIndividualBadge } from "@/features/badges/server/individual-print-eligibility";
import {
  authorizeEventActor,
  hasEventPermission,
} from "@/features/events/server/event-access";
import {
  ticketDisplaySelect,
  ticketQrDataUrl,
} from "@/features/tickets/server/ticket-display";
import { loadMessages } from "@/lib/i18n/messages";
import { prisma } from "@/lib/prisma";

const selectorSchema = z.strictObject({
  eventId: z.uuid(),
  attendeeId: z.uuid().optional(),
  previewKind: z.enum(["PRIMARY", "GUEST"]).optional(),
});
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
      (!selector.data.attendeeId ||
        selector.data.previewKind !== undefined ||
        options.draftLayout !== undefined))
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
        select: {
          id: true,
          title: true,
          language: true,
          cancelledAt: true,
          badgeLayout: true,
        },
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

      if (catalog && !validBadgeBindings(layout, catalog.fields)) {
        return null;
      }

      const person = await tx.attendee.findFirst({
        where: {
          ...(attendeeId
            ? { id: attendeeId }
            : selector.data.previewKind
              ? { kind: selector.data.previewKind }
              : {}),
          revokedAt: null,
          registration: { eventId, revokedAt: null },
        },
        // Prisma enum declaration order puts PRIMARY before GUEST.
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          kind: true,
          applicationGuestId: true,
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

      const t = createTranslator({
        locale: event.language,
        messages: await loadMessages(event.language),
        namespace: "events",
      });
      const presentation: BadgePresentation = attendeeBadgePresentation(
        layout,
        person ?? {
          name: t("badgeNamePlaceholder"),
          kind: selector.data.previewKind ?? "PRIMARY",
        },
        event.title,
      );
      presentation.qrPlaceholder = options.mode === "PREVIEW" && layout.showQr;
      const issues: BadgeIssue[] = [];

      if (!person) {
        presentation.ticketNumber = layout.showTicketNumber
          ? "EF-XXXX-XXXX"
          : null;

        for (const slot of ["secondary", "tertiary"] as const) {
          const binding =
            slot === "secondary" ? layout.secondaryField : layout.tertiaryField;

          if (
            binding &&
            catalog?.fields.some((field) => sameBadgeField(field, binding))
          ) {
            presentation[slot] = badgeText(binding.label);
          }
        }
      } else if (
        (person.kind === "PRIMARY" || person.applicationGuestId) &&
        (layout.secondaryField || layout.tertiaryField)
      ) {
        const application = await tx.application.findUniqueOrThrow({
          where: { id: person.registration.sourceApplicationId },
          select: {
            eventRevision: { select: { snapshot: true } },
            guests: {
              where: {
                id: {
                  in:
                    person.kind === "GUEST" && person.applicationGuestId
                      ? [person.applicationGuestId]
                      : [],
                },
              },
              select: {
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
            },
            answers: {
              where: {
                fieldId: {
                  in:
                    person.kind === "PRIMARY"
                      ? [
                          layout.secondaryField?.fieldId,
                          layout.tertiaryField?.fieldId,
                        ].filter((id): id is string => Boolean(id))
                      : [],
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
            person.kind === "PRIMARY"
              ? application.answers
              : (application.guests[0]?.answers ?? []),
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
        language: event.language,
        labels: badgeLabels(t),
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

export { saveBadgeLayout } from "@/features/badges/server/save-badge-layout";
