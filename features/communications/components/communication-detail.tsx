import { notFound } from "next/navigation";
import { CommunicationDetailContent } from "@/features/communications/components/communication-detail-content";
import { CommunicationDialog } from "@/features/communications/components/communication-dialog";
import { readCommunicationDetails } from "@/features/communications/server/read";
import { EventHeader } from "@/features/events/components/event-header";

export async function CommunicationDetail({
  eventId: id,
  communicationId,
  after,
  modal = false,
}: {
  eventId: string;
  communicationId: string;
  after?: string;
  modal?: boolean;
}) {
  const data = await readCommunicationDetails(id, communicationId, after);

  if (!data?.header) {
    notFound();
  }

  const { header, ...detail } = data;
  const content = (
    <CommunicationDetailContent
      eventId={id}
      communicationId={communicationId}
      data={detail}
      timezone={header.context.timezone}
      modal={modal}
    />
  );

  return modal ? (
    <CommunicationDialog>{content}</CommunicationDialog>
  ) : (
    <EventHeader eventId={id} active="communications" data={header}>
      {content}
    </EventHeader>
  );
}
