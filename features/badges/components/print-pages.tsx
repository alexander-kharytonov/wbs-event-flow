import { badgeDimensions } from "@/features/badges/badge-layout";
import type { BadgePresentation } from "@/features/badges/badge-presentation";
import { Badge } from "@/features/badges/components/badge";
import { badgeCss } from "@/features/badges/components/badge-styles";

export const printDocumentCss = `
.ef-print-document { padding: 24px; }
.ef-print-controls { margin-bottom: 24px; max-width: 600px; font-family: Arial, sans-serif; }
.ef-print-controls > button, .ef-print-controls > a { display: inline-block; margin: 8px 16px 8px 0; }
.ef-print-page { width: max-content; break-inside: avoid; margin-bottom: 24px; }
.ef-print-page .ef-badge-badge { outline: 0.2mm dashed #777; outline-offset: -0.2mm; }
@media print {
  html, body { margin: 0; padding: 0; min-height: 0; background: #fff; }
  .ef-print-document { margin: 0; padding: 0; }
  .ef-print-controls { display: none; }
  .ef-print-page { margin: 0; break-inside: avoid; }
  .ef-print-page + .ef-print-page { break-before: page; }
}`;

export function BadgePrintPages({ badges }: { badges: BadgePresentation[] }) {
  const dimensions = badgeDimensions(badges[0].style);

  return (
    <>
      <style>
        {badgeCss +
          printDocumentCss +
          `@page { size: ${dimensions.width}mm ${dimensions.height}mm; margin: 0; }`}
      </style>
      {badges.map((badge, index) => (
        // Snapshot ordering is fixed for this document; there is no editable list state.
        // biome-ignore lint/suspicious/noArrayIndexKey: immutable document
        <div className="ef-print-page" key={index}>
          <Badge badge={badge} />
        </div>
      ))}
    </>
  );
}
