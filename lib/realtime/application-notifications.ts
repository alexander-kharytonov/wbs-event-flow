import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

export const applicationNotificationChannel = "event_flow_applications";

const notificationSchema = z.strictObject({
  type: z.enum(["applications.changed", "attendance.changed"]),
  eventId: z.uuid(),
  userId: z.uuid().nullable(),
});

export function parseApplicationNotification(payload: string | undefined) {
  if (!payload || Buffer.byteLength(payload, "utf8") > 512) {
    return null;
  }

  try {
    const parsed = notificationSchema.safeParse(JSON.parse(payload));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function notifyApplicationChanged(
  tx: Prisma.TransactionClient,
  routing: { eventId: string; userId: string | null },
) {
  const payload = JSON.stringify({ type: "applications.changed", ...routing });
  // executeRaw avoids deserializing PostgreSQL's void result. SQL failures must
  // propagate: emission and the domain write belong to the same transaction.
  await tx.$executeRaw`SELECT pg_notify(${applicationNotificationChannel}::text, ${payload}::text)`;
}

export async function notifyAttendanceChanged(
  tx: Prisma.TransactionClient,
  routing: { eventId: string; userId: string | null },
) {
  const payload = JSON.stringify({ type: "attendance.changed", ...routing });
  await tx.$executeRaw`SELECT pg_notify(${applicationNotificationChannel}::text, ${payload}::text)`;
}
