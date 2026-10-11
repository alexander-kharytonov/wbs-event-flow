import type { Metadata } from "next";
import { connection } from "next/server";
import { PublicEventResults } from "@/features/events/components/public-event-results";
import { eventLanguageSchema } from "@/features/events/event-language";
import { getPublicEvents } from "@/features/events/server/get-public-events";

export const metadata: Metadata = {
  title: "Public events | Event Flow",
  description:
    "Explore public events on Event Flow and find out how to attend.",
};

export default async function PublicEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const parsedLanguage = eventLanguageSchema.safeParse(params.language);
  const language = parsedLanguage.success ? parsedLanguage.data : undefined;
  const events = await getPublicEvents(language);

  return (
    <PublicEventResults
      publishedEvents={events}
      language={language}
      now={new Date()}
    />
  );
}
