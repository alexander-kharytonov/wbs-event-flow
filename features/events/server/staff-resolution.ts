import "server-only";
import type { StaffInput } from "@/features/events/staff-input";
import type { Prisma } from "@/generated/prisma/client";

const processState = globalThis as typeof globalThis & {
  eventFlowStaffResolutionAttempts?: Map<
    string,
    { count: number; expiresAt: number }
  >;
};
const attempts =
  processState.eventFlowStaffResolutionAttempts ??
  new Map<string, { count: number; expiresAt: number }>();
processState.eventFlowStaffResolutionAttempts = attempts;

export const staffBudgetMessage =
  "Too many staff accounts to resolve right now. Please try again later.";

// Synchronous check + reservation: no await can interleave two reservations.
// Fixed ten-minute window starts at the first reservation; failures consume nothing.
export function reserveStaffResolution(actorUserId: string, emails: string[]) {
  const count = new Set(emails.map((email) => email.trim().toLowerCase())).size;

  if (count === 0) {
    return true;
  }

  const now = Date.now();

  for (const [key, value] of attempts) {
    if (value.expiresAt <= now) {
      attempts.delete(key);
    }
  }

  const current = attempts.get(actorUserId);

  if (count > 100 || (current?.count ?? 0) + count > 100) {
    return false;
  }

  if (!current && attempts.size >= 10000) {
    return false;
  }

  attempts.set(actorUserId, {
    count: (current?.count ?? 0) + count,
    expiresAt: current?.expiresAt ?? now + 10 * 60 * 1000,
  });

  return true;
}

export async function resolveStaff(
  db: Pick<Prisma.TransactionClient, "user">,
  actorUserId: string,
  members: StaffInput[],
) {
  const users = members.length
    ? await db.user.findMany({
        where: {
          email: { in: members.map((member) => member.email) },
          emailVerified: true,
        },
        select: { id: true, email: true },
      })
    : [];
  const byEmail = new Map(users.map((user) => [user.email, user.id]));
  const resolved: { userId: string; role: StaffInput["role"] }[] = [];
  const skippedEmails: string[] = [];

  for (const member of members) {
    const userId = byEmail.get(member.email);

    if (!userId || userId === actorUserId) {
      skippedEmails.push(member.email);
    } else {
      resolved.push({ userId, role: member.role });
    }
  }

  return { resolved, skippedEmails };
}
