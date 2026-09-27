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
          event: {
            select: {
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
    ({ status, event }) => {
      const parsed = eventSnapshotSchema.safeParse(
        event.publishedRevision?.snapshot,
      );

      if (!event.publicId || !parsed.success) {
        return [];
      }

      const { title, startsAt, endsAt, timezone } = parsed.data;

      return [
        { publicId: event.publicId, title, startsAt, endsAt, timezone, status },
      ];
    },
  );
  const now = Date.now();
  const upcoming = registrations.filter(
    (registration) => Date.parse(registration.endsAt) > now,
  );
  const past = registrations.filter(
    (registration) => Date.parse(registration.endsAt) <= now,
  );
  upcoming.sort(
    (a, b) =>
      Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
      a.publicId.localeCompare(b.publicId),
  );
  past.sort(
    (a, b) =>
      Date.parse(b.endsAt) - Date.parse(a.endsAt) ||
      a.publicId.localeCompare(b.publicId),
  );

  return { upcoming, past };
}
