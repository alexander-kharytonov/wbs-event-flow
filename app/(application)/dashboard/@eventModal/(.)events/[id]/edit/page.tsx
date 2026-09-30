import { EditEventView } from "@/features/events/components/event-editor";

export default async function EditEventModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditEventView eventId={id} modal />;
}
