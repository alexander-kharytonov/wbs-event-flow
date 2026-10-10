import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublishedEvent } from "@/features/events/server/get-published-event";

// No ancestor loading boundary may stream before this publication guard.
// The catalog has its own route group so invalid events retain HTTP 404.
export default async function PublicEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ publicId: string }>;
}) {
  await connection();
  const { publicId } = await params;

  if (!(await getPublishedEvent(publicId))) {
    notFound();
  }

  return children;
}
