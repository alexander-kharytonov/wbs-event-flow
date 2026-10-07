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
.ef-print-sheet {
  box-sizing: border-box;
  width: 210mm;
  height: 297mm;
  padding: 10mm;
  display: grid;
  gap: 3mm;
  align-content: start;
  background: #fff;
}
@media screen {
  body { margin: 0; background: #f1f3f5; }
  .ef-print-sheet {
    margin-bottom: 32px;
    box-shadow: 0 0 0 1px #d5d9de, 0 4px 16px rgb(0 0 0 / 10%);
  }
}
@media print {
  html, body { margin: 0; padding: 0; min-height: 0; background: #fff; }
  .ef-print-document { margin: 0; padding: 0; }
  .ef-print-controls { display: none; }
  .ef-print-page { margin: 0; break-inside: avoid; }
  .ef-print-page + .ef-print-page { break-before: page; }
  .ef-print-sheet { width: 190mm; height: 277mm; padding: 0; }
}`;

export function BadgePrintPages({ badges }: { badges: BadgePresentation[] }) {
  const dimensions = badgeDimensions(badges[0].style);
  const columns = Math.floor((190 + 3) / (dimensions.width + 3));
  const rows = Math.floor((277 + 3) / (dimensions.height + 3));
  const perPage = columns * rows;
  const pages: BadgePresentation[][] = [];

  for (let index = 0; index < badges.length; index += perPage) {
    pages.push(badges.slice(index, index + perPage));
  }

  return (
    <>
      <style>
        {badgeCss +
          printDocumentCss +
          "@page { size: A4 portrait; margin: 10mm; }"}
      </style>
      {pages.map((page, index) => (
        <div
          className="ef-print-page ef-print-sheet"
          // biome-ignore lint/suspicious/noArrayIndexKey: immutable document page order
          key={index}
          style={{
            gridTemplateColumns: `repeat(${columns}, ${dimensions.width}mm)`,
            gridAutoRows: `${dimensions.height}mm`,
          }}
        >
          {page.map((badge, badgeIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: immutable document badge order
            <Badge key={badgeIndex} badge={badge} />
          ))}
        </div>
      ))}
    </>
  );
}
