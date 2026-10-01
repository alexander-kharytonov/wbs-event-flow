import { z } from "zod";

export const MAX_BADGES_PER_DOCUMENT = 200;
export const selectedBadgeIdsSchema = z
  .array(z.uuid().transform((id) => id.toLowerCase()))
  .min(1)
  .max(MAX_BADGES_PER_DOCUMENT)
  .refine((ids) => new Set(ids).size === ids.length);
export const badgeCursorSchema = z.strictObject({
  createdAt: z.iso.datetime({ precision: 3 }),
  id: z.uuid(),
});
export const badgePrintRequestSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("SELECTED"), ids: selectedBadgeIdsSchema }),
  z.strictObject({
    mode: z.literal("ALL_ACTIVE"),
    cursor: badgeCursorSchema.optional(),
  }),
  z.strictObject({ mode: z.literal("TEAM") }),
]);

export type BadgePrintRequest = z.infer<typeof badgePrintRequestSchema>;
export type BadgeCursor = z.infer<typeof badgeCursorSchema>;

export function nextBadgeBatchUrl(eventId: string, cursor?: BadgeCursor) {
  const query = new URLSearchParams({ mode: "ALL_ACTIVE" });

  if (cursor) {
    query.set("createdAt", cursor.createdAt);
    query.set("id", cursor.id);
  }

  return `/print/events/${eventId}/badges/bulk?${query}`;
}
