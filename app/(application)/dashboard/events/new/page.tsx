import { CreateEventView } from "@/features/events/components/event-editor";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string | string[] }>;
}) {
  const { duplicateFrom } = await searchParams;

  return <CreateEventView duplicateFrom={duplicateFrom} />;
}
