import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { badgeDimensions } from "@/features/badges/badge-layout";
import { Badge } from "@/features/badges/components/badge";
import { PrintBadgeButton } from "@/features/badges/components/print-button";
import { buildBadgePresentation } from "@/features/badges/server/badges";
import { requireVerifiedUser } from "@/lib/session";
import styles from "./print.module.css";

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

  const dimensions = badgeDimensions(result.presentation.style);

  return (
    <main className={styles.document} data-badge-document>
      <style>{`@page { size: ${dimensions.width}mm ${dimensions.height}mm; margin: 0; }`}</style>
      <div className={styles.controls}>
        <PrintBadgeButton />
      </div>
      <div className={styles.page}>
        <Badge badge={result.presentation} />
      </div>
    </main>
  );
}
