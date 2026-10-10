import { z } from "zod";

export const coverCropSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  zoom: z.number().min(1).max(4),
});

export type CoverCrop = z.infer<typeof coverCropSchema>;

export const initialCoverCrop: CoverCrop = { x: 0.5, y: 0.5, zoom: 1 };

// Integer 16:9 bounds shared by the preview and the server's oriented-pixel crop.
export function coverCropRectangle(
  width: number,
  height: number,
  crop: CoverCrop,
) {
  const unit = Math.max(
    1,
    Math.floor(Math.min(width / 16, height / 9) / crop.zoom),
  );
  const cropWidth = unit * 16;
  const cropHeight = unit * 9;

  return {
    left: Math.round((width - cropWidth) * crop.x),
    top: Math.round((height - cropHeight) * crop.y),
    width: cropWidth,
    height: cropHeight,
  };
}
