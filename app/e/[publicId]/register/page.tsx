import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PublicEventExperience } from "@/features/events/components/public-event-experience";
import { getPublishedEvent } from "@/features/events/server/get-published-event";

type Props = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { publicId } = await params;

  if (!(await getPublishedEvent(publicId))) {
    notFound();
  }

  return {
    title: "Event registration",
    robots: { index: false, follow: false },
  };
}

export default async function EventRegistrationPage({ params }: Props) {
  await connection();
  const { publicId } = await params;

  return <PublicEventExperience publicId={publicId} registration />;
}
