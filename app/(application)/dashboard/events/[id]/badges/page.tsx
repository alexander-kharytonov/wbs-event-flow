import { Stack } from "@mui/material";
import { notFound } from "next/navigation";
import { BadgeWorkspace } from "@/features/badges/components/badge-workspace";
import { buildBadgePresentation } from "@/features/badges/server/badges";
import { EventHeader } from "@/features/events/components/event-header";
import { requireVerifiedUser } from "@/lib/session";

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireVerifiedUser();
  const preview = await buildBadgePresentation(
    { userId: user.id },
    { eventId: id },
    { mode: "PREVIEW" },
  );

  if (!preview) {
    notFound();
  }

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="badges" />
      <BadgeWorkspace eventId={id} initial={preview} />
    </Stack>
  );
}
