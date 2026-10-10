import type { z } from "zod";
import type { coverDescriptorSchema } from "@/features/events/schemas/event-rich-content";

export function eventCoverImage(
  cover: z.infer<typeof coverDescriptorSchema>,
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
