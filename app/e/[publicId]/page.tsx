import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EventGuestView } from "@/features/events/components/event-guest-view";
import { getPublishedEvent } from "@/features/events/server/get-published-event";

type Props = { params: Promise<{ publicId: string }> };

async function publishedSnapshot(params: Props["params"]) {
  await connection();
  const { publicId } = await params;
  const snapshot = await getPublishedEvent(publicId);

  if (!snapshot) {
    notFound();
  }

  return snapshot;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const snapshot = await publishedSnapshot(params);

  return {
    title: `${snapshot.title} | Event Flow`,
    description:
      snapshot.description?.replace(/\s+/g, " ").trim().slice(0, 160) ||
      "Event details and registration information on Event Flow.",
    robots: {
      index: snapshot.visibility === "PUBLIC",
      follow: snapshot.visibility === "PUBLIC",
    },
  };
}

export default async function PublicEventPage({ params }: Props) {
  const snapshot = await publishedSnapshot(params);

  return <EventGuestView snapshot={snapshot} now={new Date()} />;
}
