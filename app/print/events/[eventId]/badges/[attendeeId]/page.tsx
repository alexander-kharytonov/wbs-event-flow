import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintBadgeButton } from "@/features/badges/components/print-button";
import { BadgePrintPages } from "@/features/badges/components/print-pages";
import { buildBadgePresentation } from "@/features/badges/server/badges";
import { requireVerifiedUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Print badge | Event Flow",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function BadgePrintPage({
  params,
}: {
  params: Promise<{ eventId: string; attendeeId: string }>;
}) {
  const selector = await params;
  const user = await requireVerifiedUser();
  const result = await buildBadgePresentation({ userId: user.id }, selector, {
    mode: "PRINT",
  });

  if (!result) {
    notFound();
  }

  return (
    <main className="ef-print-document" data-badge-document>
      <div className="ef-print-controls">
        <PrintBadgeButton />
      </div>
      <BadgePrintPages badges={[result.presentation]} />
    </main>
  );
}
