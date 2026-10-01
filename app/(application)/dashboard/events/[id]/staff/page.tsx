import { Stack } from "@mui/material";
import { notFound } from "next/navigation";
import { EventHeader } from "@/features/events/components/event-header";
import { StaffList } from "@/features/events/components/staff-list";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export default async function StaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const members = await prisma.$transaction(
    async (tx) => {
      const access = await authorizeEventActor(tx, id, user.id, "staff.manage");

      if (!access) {
        return null;
      }

      return tx.eventStaff.findMany({
        where: { eventId: id },
        select: {
          userId: true,
          role: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
      });
    },
    { isolationLevel: "RepeatableRead" },
  );

  if (!members) {
    notFound();
  }

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="staff" />
      <StaffList eventId={id} members={members} />
    </Stack>
  );
}
