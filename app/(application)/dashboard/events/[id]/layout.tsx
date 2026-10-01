import type { ReactNode } from "react";
import { EventWorkspace } from "@/features/events/components/event-workspace";
import { requireEventPermission } from "@/features/events/server/require-event-permission";

export default async function EventLayout({
  children,
  applicationModal,
  params,
}: {
  children: ReactNode;
  applicationModal: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireEventPermission(id, "event.context.read");

  return (
    <EventWorkspace eventId={id} role={access.role}>
      {children}
      {applicationModal}
    </EventWorkspace>
  );
}
