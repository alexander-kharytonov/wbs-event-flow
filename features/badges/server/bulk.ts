import "server-only";
import { z } from "zod";
import { readBadgeLayout } from "@/features/badges/badge-layout";
import {
  attendeeBadgePresentation,
  type BadgePresentation,
  badgeStyle,
  badgeText,
} from "@/features/badges/badge-presentation";
import {
  type BadgeCursor,
  badgePrintRequestSchema,
  MAX_BADGES_PER_DOCUMENT,
} from "@/features/badges/print-request";
import { resolveBadgeField } from "@/features/badges/server/historical-field";
import {
  authorizeEventActor,
  hasEventPermission,
} from "@/features/events/server/event-access";
import {
  ticketDisplaySelect,
  ticketQrDataUrl,
} from "@/features/tickets/server/ticket-display";
import type { UiLocale } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";

export const selectedUnavailable = "printSelectionUnavailable";
const unavailable = "printUnavailable";
const teamTooLarge = "badgeTeamTooLarge";

// Only selection data crosses the workspace boundary, never answers or presentations.
export async function readBadgeWorkspace(
  actor: { userId: string },
  eventId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const access = await authorizeEventActor(
        tx,
        eventId,
        actor.userId,
        "badges.print.bulk",
      );

      if (!access) {
        return null;
      }

      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { cancelledAt: true },
      });
      const attendees = await tx.attendee.findMany({
        where: { revokedAt: null, registration: { eventId, revokedAt: null } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          kind: true,
          registration: {
            select: {
              attendees: {
                where: { kind: "PRIMARY" },
                select: { name: true },
              },
            },
          },
        },
      });
      const teamAccess = await authorizeEventActor(
        tx,
        eventId,
        actor.userId,
        "badges.print.team",
      );
      const owner = teamAccess
        ? await tx.event.findUniqueOrThrow({
            where: { id: eventId },
            select: {
              organizer: {
                select: { user: { select: { name: true, email: true } } },
              },
            },
          })
        : null;
      const staff = teamAccess
        ? await tx.eventStaff.findMany({
            where: { eventId },
            take: MAX_BADGES_PER_DOCUMENT,
            orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
            select: {
              role: true,
              user: { select: { name: true, email: true } },
            },
          })
        : [];

      return {
        configure: hasEventPermission(access.role, "badges.configure"),
        cancelled: Boolean(event.cancelledAt),
        attendees: attendees.map((attendee) => ({
          id: attendee.id,
          name: attendee.name,
          kind: attendee.kind,
          primaryAttendeeName:
            attendee.kind === "GUEST"
              ? (attendee.registration.attendees[0]?.name ?? null)
              : null,
        })),
        teamTooLarge: staff.length >= MAX_BADGES_PER_DOCUMENT,
        team:
          owner && staff.length < MAX_BADGES_PER_DOCUMENT
            ? [
                {
                  name: owner.organizer.user.name,
                  email: owner.organizer.user.email,
                  role: "OWNER" as const,
                },
                ...staff.map((member) => ({
                  name: member.user.name,
                  email: member.user.email,
                  role: member.role,
                })),
              ]
            : [],
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export type BulkBadgeResult =
  | { error: string }
  | {
      language: UiLocale;
      presentations: BadgePresentation[];
      nextCursor: BadgeCursor | null;
    };

export async function buildBulkBadgeDocument(
  actor: { userId: string },
  eventId: string,
  input: unknown,
): Promise<BulkBadgeResult> {
  const parsed = badgePrintRequestSchema.safeParse(input);

  if (!z.uuid().safeParse(eventId).success || !parsed.success) {
    return {
      error: "printSelectionLimit",
    };
  }

  const request = parsed.data;
  const snapshot = await prisma.$transaction(
    async (tx) => {
      const access = await authorizeEventActor(
        tx,
        eventId,
        actor.userId,
        request.mode === "TEAM" ? "badges.print.team" : "badges.print.bulk",
      );

      if (!access) {
        return { error: unavailable };
      }

      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          title: true,
          language: true,
          badgeLayout: true,
          cancelledAt: true,
        },
      });
      const saved = readBadgeLayout(event.badgeLayout);

      if (event.cancelledAt || !saved.success) {
        return { error: unavailable };
      }

      const layout = saved.data;

      if (request.mode === "TEAM") {
        const staff = await tx.eventStaff.findMany({
          where: { eventId },
          take: MAX_BADGES_PER_DOCUMENT,
          orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
          select: { role: true, user: { select: { name: true } } },
        });

        if (staff.length >= MAX_BADGES_PER_DOCUMENT) {
          return { error: teamTooLarge };
        }

        const owner = await tx.event.findUniqueOrThrow({
          where: { id: eventId },
          select: {
            organizer: { select: { user: { select: { name: true } } } },
          },
        });
        const team = [
          { name: owner.organizer.user.name, role: "Organizer" as const },
          ...staff.map((member) => ({
            name: member.user.name,
            role:
              member.role === "MANAGER"
                ? ("Manager" as const)
                : ("Reception" as const),
          })),
        ];

        return { event, layout, team };
      }

      const cursor = request.mode === "ALL_ACTIVE" ? request.cursor : undefined;
      const rows = await tx.attendee.findMany({
        where: {
          revokedAt: null,
          registration: { eventId, revokedAt: null },
          ...(request.mode === "SELECTED" ? { id: { in: request.ids } } : {}),
          ...(cursor
            ? {
                OR: [
                  { createdAt: { gt: new Date(cursor.createdAt) } },
                  {
                    createdAt: new Date(cursor.createdAt),
                    id: { gt: cursor.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: MAX_BADGES_PER_DOCUMENT + 1,
        select: {
          id: true,
          name: true,
          kind: true,
          createdAt: true,
          applicationGuestId: true,
          registration: { select: { sourceApplicationId: true } },
        },
      });

      if (request.mode === "SELECTED" && rows.length !== request.ids.length) {
        return { error: selectedUnavailable };
      }

      if (!rows.length) {
        return {
          error: cursor ? "printNoMore" : "printNoActive",
        };
      }

      const people = rows.slice(0, MAX_BADGES_PER_DOCUMENT);
      const last = people[people.length - 1];
      const nextCursor =
        rows.length > MAX_BADGES_PER_DOCUMENT
          ? { createdAt: last.createdAt.toISOString(), id: last.id }
          : null;
      // Limit is settled before any historical answers or Ticket crypto are read.
      const fieldIds = [
        layout.secondaryField?.fieldId,
        layout.tertiaryField?.fieldId,
      ].filter((id): id is string => Boolean(id));
      const applicationIds = [
        ...new Set(
          people.map((person) => person.registration.sourceApplicationId),
        ),
      ];
      const applications = fieldIds.length
        ? await tx.application.findMany({
            where: { id: { in: applicationIds } },
            select: {
              id: true,
              eventRevision: { select: { snapshot: true } },
              guests: {
                where: {
                  id: {
                    in: people.flatMap((person) =>
                      person.applicationGuestId
                        ? [person.applicationGuestId]
                        : [],
                    ),
                  },
                },
                select: {
                  id: true,
                  answers: {
                    where: { fieldId: { in: fieldIds } },
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
                where: { fieldId: { in: fieldIds } },
                select: {
                  fieldId: true,
                  textValue: true,
                  booleanValue: true,
                  selectedOptions: { select: { optionId: true } },
                },
              },
            },
          })
        : [];
      const tickets =
        layout.showQr || layout.showTicketNumber
          ? await tx.ticket.findMany({
              where: {
                attendeeId: { in: people.map((person) => person.id) },
                revokedAt: null,
              },
              select: ticketDisplaySelect,
            })
          : [];

      return { event, layout, people, applications, tickets, nextCursor };
    },
    { isolationLevel: "RepeatableRead" },
  );

  if ("error" in snapshot) {
    return { error: snapshot.error ?? unavailable };
  }

  const { event, layout } = snapshot;
  const presentations: BadgePresentation[] = [];

  if (snapshot.team) {
    for (const person of snapshot.team) {
      presentations.push({
        variant: "TEAM",
        name: badgeText(person.name),
        role: person.role,
        eventName: layout.showEventName ? badgeText(event.title) : null,
        attendeeType: null,
        secondary: null,
        tertiary: null,
        ticketNumber: null,
        qrDataUrl: null,
        qrPlaceholder: false,
        style: badgeStyle(layout),
      });
    }
  } else {
    const applications = new Map(
      snapshot.applications.map((application) => [application.id, application]),
    );
    const tickets = new Map(
      snapshot.tickets.map((ticket) => [ticket.attendeeId, ticket]),
    );

    for (const person of snapshot.people) {
      const presentation = attendeeBadgePresentation(
        layout,
        person,
        event.title,
      );
      const application = applications.get(
        person.registration.sourceApplicationId,
      );

      if (application) {
        for (const slot of ["secondary", "tertiary"] as const) {
          const binding =
            slot === "secondary" ? layout.secondaryField : layout.tertiaryField;

          if (binding) {
            const resolved = resolveBadgeField(
              binding,
              application.eventRevision.snapshot,
              person.kind === "PRIMARY"
                ? application.answers
                : (application.guests.find(
                    (guest) => guest.id === person.applicationGuestId,
                  )?.answers ?? []),
              person.kind,
            );

            if (resolved.status === "VALUE") {
              presentation[slot] = resolved.value;
            }
          }
        }
      }

      const ticket = tickets.get(person.id);

      if (ticket) {
        // Sequential generation outside the DB snapshot, preserving AAD/hash verification.
        try {
          presentation.qrDataUrl = layout.showQr
            ? await ticketQrDataUrl(ticket)
            : null;
          presentation.ticketNumber = layout.showTicketNumber
            ? ticket.number
            : null;
        } catch {
          return {
            error: "printPrepareFailed",
          };
        }
      }

      presentations.push(presentation);
    }
  }

  if (!presentations.length || presentations.length > MAX_BADGES_PER_DOCUMENT) {
    return { error: unavailable };
  }

  return {
    language: event.language,
    presentations,
    nextCursor: snapshot.nextCursor ?? null,
  };
}
