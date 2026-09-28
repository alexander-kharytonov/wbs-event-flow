import { OrganizerEventList } from "@/features/events/components/organizer-event-list";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const { visibility } = await searchParams;

  return <OrganizerEventList archived={false} visibility={visibility} />;
}
