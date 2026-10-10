import { z } from "zod";

// Frozen serialized v3 contracts; do not derive these from future editor rules.
const publicUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    const url = URL.parse(value);

    return Boolean(
      url &&
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password,
    );
  });
const venue = {
  venueName: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(1000),
};
const online = {
  onlineLabel: z.string().trim().min(1).max(200),
  onlineUrl: publicUrl,
};

export const locationSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("PHYSICAL"), ...venue }),
  z.strictObject({ type: z.literal("ONLINE"), ...online }),
  z.strictObject({ type: z.literal("HYBRID"), ...venue, ...online }),
]);

export const scheduleSchema = z
  .array(
    z.strictObject({
      title: z.string().trim().min(1).max(200),
      description: z.string().max(2000).nullable(),
      startsAt: z.iso.datetime({ precision: 3 }),
    }),
  )
  .max(100);

export const publicOrganizerSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable(),
  websiteUrl: publicUrl.nullable(),
});

export const coverVariantSchema = z.strictObject({
  width: z.number().int().min(1).max(1920),
  height: z.number().int().min(1).max(4096),
  bytes: z
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024),
  contentType: z.enum(["image/webp", "image/jpeg"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export const mediaVariants = ["640", "1280", "1920", "social"] as const;

export const mediaManifestSchema = z.strictObject({
  "640": coverVariantSchema.extend({
    contentType: z.literal("image/webp"),
    width: z.number().int().min(1).max(640),
  }),
  "1280": coverVariantSchema.extend({
    contentType: z.literal("image/webp"),
    width: z.number().int().min(1).max(1280),
  }),
  "1920": coverVariantSchema.extend({ contentType: z.literal("image/webp") }),
  social: coverVariantSchema.extend({
    contentType: z.literal("image/jpeg"),
    width: z.number().int().min(1).max(1200),
  }),
});

export type MediaVariant = (typeof mediaVariants)[number];
export type MediaManifest = z.infer<typeof mediaManifestSchema>;

export const coverDescriptorSchema = z.strictObject({
  assetId: z.uuid(),
  alt: z.string().trim().max(500).nullable(),
  variants: mediaManifestSchema,
});
