import type { BadgeLayout } from "@/features/badges/badge-layout";

// Only rendered values and constrained visual settings cross the UI boundary.
export type BadgePresentation = {
  name: string;
  eventName: string | null;
  attendeeType: "PRIMARY" | "GUEST" | null;
  secondary: string | null;
  tertiary: string | null;
  ticketNumber: string | null;
  qrDataUrl: string | null;
  qrPlaceholder: boolean;
  style: Pick<
    BadgeLayout,
    "preset" | "size" | "orientation" | "nameSize" | "alignment"
  >;
};

export type BadgeIssue = {
  slot: "secondary" | "tertiary";
  reason: "INCOMPATIBLE" | "UNAVAILABLE";
};

export function badgeText(value: string) {
  // Presentation only: flatten controls/whitespace and remove directional
  // embeddings, overrides, isolates and deprecated directional controls.
  // Preserve joiners, directional marks and other meaningful Unicode formatting.
  const normalized = value
    .replace(/[\p{Cc}\u200B\u202A-\u202E\u2066-\u206F\uFEFF]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      normalized,
    ),
  )
    .slice(0, 500)
    .map(({ segment }) => segment)
    .join("");
}

export function badgeStyle(layout: BadgeLayout): BadgePresentation["style"] {
  return {
    preset: layout.preset,
    size: layout.size,
    orientation: layout.orientation,
    nameSize: layout.nameSize,
    alignment: layout.alignment,
  };
}
