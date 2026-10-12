import { OrganizerEventResults } from "@/features/events/components/organizer-event-results";
import { readStaffEvents } from "@/features/events/server/staff-events";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export default async function StaffEventsPage() {
  const user = await requireVerifiedUser();
  const events = await readStaffEvents(prisma, user.id);

  return <OrganizerEventResults events={events} canCreate={false} staff />;
}
