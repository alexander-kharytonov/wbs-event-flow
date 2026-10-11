import type { z } from "zod";
import type { coverDescriptorSchema } from "@/features/events/schemas/event-rich-content";

export function eventCoverImage(
  cover: Pick<z.infer<typeof coverDescriptorSchema>, "alt"> & {
    variants: {
      "640": { width: number };
      "1280": { width: number; height: number };
      "1920": { width: number };
    };
  },
  basePath: string,
) {
  const widths = new Map<number, string>();

  for (const variant of ["640", "1280", "1920"] as const) {
    const width = cover.variants[variant].width;

    if (!widths.has(width)) {
      widths.set(width, `${basePath}/${variant} ${width}w`);
    }
  }

  return {
    src: `${basePath}/1280`,
    srcSet: [...widths.values()].join(", "),
    sizes:
      "(min-width: 1200px) 1152px, (min-width: 600px) calc(100vw - 48px), calc(100vw - 32px)",
    width: cover.variants["1280"].width,
    height: cover.variants["1280"].height,
    alt: cover.alt ?? "",
  };
}
