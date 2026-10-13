import "server-only";
import {
  authorizeEventActor,
  type EventPermission,
  hasEventPermission,
} from "@/features/events/server/event-access";
import {
  buildApplicationsCsv,
  buildAttendanceCsv,
  buildAttendeesCsv,
  buildStaffCsv,
} from "@/features/exports/server/export-datasets";
import { prisma } from "@/lib/prisma";

export const exportPermissions = {
  applications: ["applications.read"],
  attendees: ["attendees.read.full", "applications.read"],
  attendance: ["attendees.read.full"],
  staff: ["staff.manage"],
} as const satisfies Record<string, readonly EventPermission[]>;

export type ExportDataset = keyof typeof exportPermissions;

// Called only with a fresh session-derived userId. No client identity is accepted.
export async function buildEventCsv(
  userId: string,
  eventId: string,
  dataset: ExportDataset,
) {
  return prisma.$transaction(
    async (tx) => {
      const required = exportPermissions[dataset];
      const access = await authorizeEventActor(
        tx,
        eventId,
        userId,
        required[0],
      );

      if (
        !access ||
        !required.every((permission) =>
          hasEventPermission(access.role, permission),
        )
      ) {
        return null;
      }

      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { title: true, timezone: true },
      });
      const context = [event.title, event.timezone];
      let csv: string;

      if (dataset === "applications") {
        csv = await buildApplicationsCsv(tx, eventId, context);
      } else if (dataset === "attendees") {
        csv = await buildAttendeesCsv(tx, eventId, context);
      } else if (dataset === "attendance") {
        csv = await buildAttendanceCsv(tx, eventId, context);
      } else {
        csv = await buildStaffCsv(tx, eventId, context);
      }

      const slug =
        event.title
          .normalize("NFKD")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80) || "event";

      return { csv, filename: `${slug}-${dataset}.csv` };
    },
    { isolationLevel: "RepeatableRead", timeout: 30_000 },
  );
}
