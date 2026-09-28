import { OrganizerEventList } from "@/features/events/components/organizer-event-list";

export default async function ArchivedEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ visibility?: string | string[] }>;
}) {
  const { visibility } = await searchParams;

  return <OrganizerEventList archived visibility={visibility} />;
}
