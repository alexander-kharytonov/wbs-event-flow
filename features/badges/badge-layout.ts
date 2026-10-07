import { z } from "zod";

export const badgeFieldSchema = z.strictObject({
  fieldId: z.string().min(1).max(200),
  type: z.enum(["SHORT_TEXT", "LONG_TEXT", "SINGLE_CHOICE"]),
  label: z.string().min(1).max(200),
});

export const badgeLayoutSchema = z.strictObject({
  formatVersion: z.literal(1),
  size: z.enum(["STANDARD", "CARD", "LARGE"]),
  orientation: z.enum(["PORTRAIT", "LANDSCAPE"]),
  showEventName: z.boolean(),
  showAttendeeType: z.boolean(),
  showQr: z.boolean(),
  showTicketNumber: z.boolean(),
  secondaryField: badgeFieldSchema.nullable(),
  tertiaryField: badgeFieldSchema.nullable(),
  nameSize: z.enum(["SMALL", "MEDIUM", "LARGE"]),
  alignment: z.enum(["LEFT", "CENTER"]),
  paddingMm: z.number().int().min(0).max(10).default(3),
});

export type BadgeLayout = z.infer<typeof badgeLayoutSchema>;
export type BadgeField = z.infer<typeof badgeFieldSchema>;

export const defaultBadgeLayout: BadgeLayout = {
  formatVersion: 1,
  size: "STANDARD",
  orientation: "LANDSCAPE",
  showEventName: true,
  showAttendeeType: true,
  showQr: true,
  showTicketNumber: true,
  secondaryField: null,
  tertiaryField: null,
  nameSize: "MEDIUM",
  alignment: "LEFT",
  paddingMm: 3,
};

export const badgeSizes = {
  STANDARD: { label: "90 × 60 mm", width: 90, height: 60 },
  CARD: { label: "85 × 54 mm", width: 85, height: 54 },
  LARGE: { label: "100 × 70 mm", width: 100, height: 70 },
} as const;

export function badgeDimensions(
  layout: Pick<BadgeLayout, "size" | "orientation">,
) {
  const size = badgeSizes[layout.size];

  return layout.orientation === "LANDSCAPE"
    ? { width: size.width, height: size.height }
    : { width: size.height, height: size.width };
}

export function readBadgeLayout(value: unknown) {
  // Existing saved layouts may still contain the removed preset setting.
  const storedLayoutSchema = badgeLayoutSchema
    .extend({
      preset: z.enum(["CLASSIC", "MINIMAL", "CHECK_IN"]).optional(),
    })
    .transform(({ preset: _preset, ...layout }) => layout);

  return storedLayoutSchema.safeParse(
    value === null ? defaultBadgeLayout : value,
  );
}

export function sameBadgeField(a: BadgeField, b: BadgeField) {
  return a.fieldId === b.fieldId && a.type === b.type && a.label === b.label;
}
