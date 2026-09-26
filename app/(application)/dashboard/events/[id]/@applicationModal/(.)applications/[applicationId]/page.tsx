import { ApplicationDetail } from "@/features/events/components/application-detail";

export default async function ApplicationModalPage({
  params,
}: {
  params: Promise<{ id: string; applicationId: string }>;
}) {
  const { id, applicationId } = await params;

  return <ApplicationDetail eventId={id} applicationId={applicationId} modal />;
}
