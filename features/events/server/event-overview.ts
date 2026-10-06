import "server-only";
import { z } from "zod";
import { eventLifecycle } from "@/features/events/event-lifecycle";
import {
  arrivalBuckets,
  timelinePlan,
} from "@/features/events/overview-timeline";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { hasEventPermission } from "@/features/events/server/event-access";
import { readEventHeader } from "@/features/events/server/event-header";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export async function getEventOverview(eventId: string) {
  const user = await requireVerifiedUser();

  if (!z.uuid().safeParse(eventId).success) {
    return null;
  }

  return prisma.$transaction(
    async (tx) => {
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`
      SELECT clock_timestamp()::timestamptz(3) AS now
    `;
      const header = await readEventHeader(tx, eventId, user.id);

      if (!header) {
        return null;
      }

      const event = header.context;
      const lifecycle = eventLifecycle(event, now);
      const { description } = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { description: true },
      });
      const active = header.attendeeCount;
      const activeWhere = {
        revokedAt: null,
        registration: { eventId, revokedAt: null },
      };
      const common = { header, now, lifecycle, description, active };

      // Reception never queries application aggregates, methods, policy or timeline.
      if (!hasEventPermission(header.access.role, "attendees.read.full")) {
        const checkedIn = await tx.attendance.count({
          where: { attendee: activeWhere },
        });

        return {
          ...common,
          full: false as const,
          checkedIn,
          notArrived: active - checkedIn,
        };
      }

      const everPublished = header.ownerEvent
        ? header.ownerEvent._count.revisions > 0
        : (await tx.eventRevision.count({ where: { eventId } })) > 0;
      const methods = everPublished ? { QR: 0, MANUAL: 0 } : null;

      if (methods) {
        const methodRows = await tx.attendance.groupBy({
          by: ["method"],
          where: { attendee: activeWhere },
          _count: { _all: true },
        });

        for (const row of methodRows) {
          methods[row.method] = row._count._all;
        }
      }

      const checkedIn = methods
        ? methods.QR + methods.MANUAL
        : await tx.attendance.count({ where: { attendee: activeWhere } });
      const applicationRows = await tx.application.groupBy({
        by: ["status"],
        where: { eventId },
        _count: { _all: true },
      });
      const applications = {
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
        WITHDRAWN: 0,
      };

      for (const row of applicationRows) {
        applications[row.status] = row._count._all;
      }

      const revision =
        header.ownerEvent?.publishedRevision ??
        header.published?.publishedRevision;
      const parsed = eventSnapshotSchema.safeParse(revision?.snapshot);
      const publication = !revision
        ? "unpublished"
        : parsed.success
          ? "valid"
          : "invalid";
      // Only the published registration policy is projected, never the form/answers.
      const registration = parsed.success
        ? {
            endsAt: parsed.data.endsAt,
            registrationOpensAt: parsed.data.registrationOpensAt,
            registrationClosesAt: parsed.data.registrationClosesAt,
            timezone: parsed.data.timezone,
          }
        : null;
      let timeline = null;

      if (
        everPublished &&
        (lifecycle === "Ongoing" || lifecycle === "Completed")
      ) {
        const plan = timelinePlan(event.startsAt, event.endsAt, event.timezone);
        const rows = await tx.$queryRaw<{ bucket: number; count: bigint }[]>`
        SELECT floor((extract(epoch FROM h."checkedInAt") * 1000 - ${plan.origin}::numeric)
          / ${plan.stepMs}::numeric)::integer AS bucket, count(*) AS count
        FROM "Registration" r
        JOIN "Attendee" a ON a."registrationId" = r.id AND a."revokedAt" IS NULL
        JOIN "Attendance" h ON h."attendeeId" = a.id
        WHERE r."eventId" = ${eventId}::uuid AND r."revokedAt" IS NULL
          AND h."checkedInAt" >= ${event.startsAt}
          AND h."checkedInAt" < ${event.endsAt}
          AND h."checkedInAt" <= ${now}
        GROUP BY bucket ORDER BY bucket
      `;
        timeline = {
          stepMinutes: plan.stepMs / 60000,
          buckets: arrivalBuckets(
            plan,
            event.endsAt,
            now,
            rows.map((row) => ({
              bucket: row.bucket,
              count: Number(row.count),
            })),
          ),
        };
      }

      return {
        ...common,
        full: true as const,
        checkedIn,
        notArrived: active - checkedIn,
        rate: !everPublished || active === 0 ? null : checkedIn / active,
        methods,
        applications,
        publication,
        registration,
        everPublished,
        timeline,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export type EventOverview = NonNullable<
  Awaited<ReturnType<typeof getEventOverview>>
>;
