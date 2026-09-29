import "server-only";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { prisma } from "@/lib/prisma";

// Call only with the user ID returned by the authoritative server session.
export async function getMyRegistrations(userId: string) {
  const applications = await prisma.$transaction(
    (tx) =>
      tx.application.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          eventId: true,
          status: true,
          registrations: {
            where: { userId },
            select: { createdAt: true, revokedAt: true },
          },
          event: {
            select: {
              cancelledAt: true,
              cancellationReason: true,
              publicId: true,
              publishedRevision: { select: { snapshot: true } },
            },
          },
        },
      }),
    { isolationLevel: "RepeatableRead" },
  );
  const currentByEvent = new Map<string, (typeof applications)[number]>();

  for (const application of applications) {
    const current = currentByEvent.get(application.eventId);

    // Descending order retains the latest withdrawn attempt unless a current
    // non-withdrawn attempt exists. REJECTED is also a current blocking state.
    if (
      !current ||
      (current.status === "WITHDRAWN" && application.status !== "WITHDRAWN")
    ) {
      currentByEvent.set(application.eventId, application);
    }
  }

  const registrations = [...currentByEvent.values()].flatMap(
    ({ eventId, status, event, registrations: admissions }) => {
      const parsed = eventSnapshotSchema.safeParse(
        event.publishedRevision?.snapshot,
      );

      const context = event.publicId && parsed.success ? parsed.data : null;

      return [
        {
          eventId,
          publicId: context ? event.publicId : null,
          cancelledAt: event.cancelledAt,
          cancellationReason: event.cancellationReason,
          title: context?.title ?? "Event unavailable",
          startsAt: context?.startsAt ?? null,
          endsAt: context?.endsAt ?? null,
          timezone: context?.timezone ?? null,
          status,
          admission: admissions[0] ?? null,
        },
      ];
    },
  );
  const now = Date.now();
  const upcoming = registrations.filter(
    (registration) =>
      registration.endsAt !== null && Date.parse(registration.endsAt) > now,
  );
  const past = registrations.filter(
    (registration) =>
      registration.endsAt !== null && Date.parse(registration.endsAt) <= now,
  );
  upcoming.sort(
    (a, b) =>
      Date.parse(a.startsAt ?? "") - Date.parse(b.startsAt ?? "") ||
      (a.publicId ?? a.eventId).localeCompare(b.publicId ?? b.eventId),
  );
  past.sort(
    (a, b) =>
      Date.parse(b.endsAt ?? "") - Date.parse(a.endsAt ?? "") ||
      (a.publicId ?? a.eventId).localeCompare(b.publicId ?? b.eventId),
  );

  return {
    upcoming,
    past,
    unavailable: registrations.filter((registration) => !registration.endsAt),
  };
}
