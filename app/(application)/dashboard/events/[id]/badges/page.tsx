import { Stack } from "@mui/material";
import { notFound } from "next/navigation";
import { BadgeWorkspace } from "@/features/badges/components/badge-workspace";
import { OperationalBadgeWorkspace } from "@/features/badges/components/operational-workspace";
import { buildBadgePresentation } from "@/features/badges/server/badges";
import { readBadgeWorkspace } from "@/features/badges/server/bulk";
import { EventHeader } from "@/features/events/components/event-header";
import { requireVerifiedUser } from "@/lib/session";

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireVerifiedUser();
  const data = await readBadgeWorkspace({ userId: user.id }, id);

  if (!data) {
    notFound();
  }

  const preview = data.configure
    ? await buildBadgePresentation(
        { userId: user.id },
        { eventId: id },
        { mode: "PREVIEW" },
      )
    : null;

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="badges" />
      <OperationalBadgeWorkspace
        eventId={id}
        data={data}
        designer={
          preview?.editor ? (
            <BadgeWorkspace eventId={id} initial={preview} />
          ) : null
        }
      />
    </Stack>
  );
}
