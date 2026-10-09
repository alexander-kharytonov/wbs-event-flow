import { CreateEventView } from "@/features/events/components/event-editor";

export default async function CreateEventModalPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string | string[] }>;
}) {
  const { duplicateFrom } = await searchParams;

  return <CreateEventView modal duplicateFrom={duplicateFrom} />;
}
