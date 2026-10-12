import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  type CoverCrop,
  coverCropRectangle,
  coverCropSchema,
  initialCoverCrop,
} from "@/features/events/cover-crop";
import {
  type MediaManifest,
  type MediaVariant,
  mediaManifestSchema,
  mediaVariants,
} from "@/features/events/schemas/event-rich-content";
import type { Messages } from "@/lib/i18n/messages";

export const maxUploadBytes = 5 * 1024 * 1024;

export class MediaError extends Error {
  constructor(
    public status: number,
    public code: keyof Messages["events"],
  ) {
    super(code);
  }
}

const resources = globalThis as typeof globalThis & {
  eventMediaProcessing?: number;
};

export async function withImageSlot<T>(operation: () => Promise<T>) {
  if ((resources.eventMediaProcessing ?? 0) >= 2) {
    throw new MediaError(429, "mediaBusy");
  }

  resources.eventMediaProcessing = (resources.eventMediaProcessing ?? 0) + 1;

  try {
    return await operation();
  } finally {
    resources.eventMediaProcessing -= 1;
  }
}

export async function readUpload(request: Request, maximum = maxUploadBytes) {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > maxUploadBytes) {
    throw new Error("Invalid upload limit.");
  }

  const reader = request.body?.getReader();

  if (!reader) {
    throw new MediaError(400, "mediaUploadRequired");
  }

  const buffer = Buffer.allocUnsafe(maximum);
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 30_000);

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (timedOut) {
        throw new MediaError(408, "mediaTimeout");
      }

      if (done) {
        break;
      }

      if (value.byteLength > maximum - size) {
        await reader.cancel();
        throw new MediaError(413, "mediaSize");
      }

      buffer.set(value, size);
      size += value.byteLength;
    }

    // Only initialized bytes escape. Retained memory is independent of chunk count.
    return buffer.subarray(0, size);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

function invalidImage(): never {
  throw new MediaError(422, "mediaValidImage");
}

// Validate container boundaries before decoding. JPEG phone trailers are discarded;
// PNG and WebP still require an exact container boundary.
function imageInput(bytes: Buffer, contentType: string) {
  if (
    contentType === "image/png" &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    let position = 8;

    while (position + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(position);
      const type = bytes.toString("ascii", position + 4, position + 8);

      if (
        ["acTL", "fcTL", "fdAT"].includes(type) ||
        position + length + 12 > bytes.length
      ) {
        invalidImage();
      }

      position += length + 12;

      if (type === "IEND") {
        if (length !== 0 || position !== bytes.length) {
          invalidImage();
        }

        return { format: "png", bytes };
      }
    }
  }

  if (
    contentType === "image/webp" &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP" &&
    bytes.readUInt32LE(4) + 8 === bytes.length
  ) {
    let position = 12;

    while (position + 8 <= bytes.length) {
      const type = bytes.toString("ascii", position, position + 4);
      const size = bytes.readUInt32LE(position + 4);

      if (
        ["ANIM", "ANMF"].includes(type) ||
        (type === "VP8X" && (bytes[position + 8] & 2) !== 0)
      ) {
        invalidImage();
      }

      position += 8 + size + (size % 2);
    }

    if (position === bytes.length) {
      return { format: "webp", bytes };
    }
  }

  if (contentType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let position = 2;
    let entropy = false;

    while (position < bytes.length) {
      if (bytes[position++] !== 0xff) {
        if (entropy) {
          continue;
        }

        invalidImage();
      }

      while (bytes[position] === 0xff) {
        position += 1;
      }

      const marker = bytes[position++];

      if (entropy && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7))) {
        continue;
      }

      if (marker === 0xd9) {
        // EOI is reached by parsing segments and scan data, not a byte search:
        // embedded thumbnails may contain their own EOI markers.
        return { format: "jpeg", bytes: bytes.subarray(0, position) };
      }

      if (position + 2 > bytes.length || marker === 0xd8) {
        invalidImage();
      }

      const length = bytes.readUInt16BE(position);

      if (length < 2 || position + length > bytes.length) {
        invalidImage();
      }

      position += length;
      entropy = marker === 0xda;
    }
  }

  return invalidImage();
}

export async function normalizeImage(
  bytes: Buffer,
  contentType: string,
  crop: CoverCrop = initialCoverCrop,
) {
  if (bytes.length > maxUploadBytes) {
    throw new MediaError(413, "mediaMaxSize");
  }

  const input = imageInput(bytes, contentType);
  const options = {
    failOn: "warning" as const,
    limitInputPixels: 16_777_216,
    limitInputChannels: 4,
  };

  try {
    const metadata = await sharp(input.bytes, options).metadata();

    if (
      metadata.format !== input.format ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 4096 ||
      metadata.height > 4096 ||
      (metadata.pages ?? 1) !== 1
    ) {
      invalidImage();
    }

    const manifest: Record<string, unknown> = {};
    const variants = new Map<MediaVariant, Buffer>();
    const parsedCrop = coverCropSchema.safeParse(crop);
    const { width, height } = metadata.autoOrient;

    if (!parsedCrop.success || width < 16 || height < 9) {
      throw new MediaError(422, "mediaCropDimensions");
    }

    const rectangle = coverCropRectangle(width, height, parsedCrop.data);

    for (const variant of mediaVariants) {
      const pipeline = sharp(input.bytes, options)
        .autoOrient()
        .extract(rectangle)
        .toColourspace("srgb")
        .resize({
          width: variant === "social" ? 1200 : Number(variant),
          withoutEnlargement: true,
        })
        .timeout({ seconds: 10 });
      const { data, info } = await (variant === "social"
        ? pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 85 })
        : pipeline.webp({ quality: 85 })
      ).toBuffer({ resolveWithObject: true });

      if (data.length > maxUploadBytes) {
        invalidImage();
      }

      manifest[variant] = {
        width: info.width,
        height: info.height,
        bytes: data.length,
        contentType: variant === "social" ? "image/jpeg" : "image/webp",
        sha256: createHash("sha256").update(data).digest("hex"),
      };
      variants.set(variant, data);
    }

    return {
      manifest: mediaManifestSchema.parse(manifest) as MediaManifest,
      variants,
    };
  } catch (error) {
    if (error instanceof MediaError) {
      throw error;
    }

    return invalidImage();
  }
}
