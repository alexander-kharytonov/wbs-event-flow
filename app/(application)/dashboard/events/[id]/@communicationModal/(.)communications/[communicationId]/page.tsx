import { CommunicationDetail } from "@/features/communications/components/communication-detail";

export default async function CommunicationDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; communicationId: string }>;
  searchParams: Promise<{ after?: string }>;
}) {
  const { id, communicationId } = await params;
  const { after } = await searchParams;

  return (
    <CommunicationDetail
      eventId={id}
      communicationId={communicationId}
      after={after}
      modal
    />
  );
}
