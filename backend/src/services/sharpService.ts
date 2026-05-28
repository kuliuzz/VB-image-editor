// Image processing service using Sharp. Handles EXIF orientation normalisation on upload, thumbnail generation, and applying the full edit-operation pipeline for downloads.

import sharp from "sharp";
import { Op } from "../types";

export async function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath)
    .rotate() // normalize EXIF orientation
    .resize(200, 200, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toFile(outputPath);
}

export async function normalizeOrientation(inputPath: string, outputPath: string): Promise<{ width: number; height: number }> {
  const info = await sharp(inputPath)
    .rotate() // bake EXIF orientation
    .toFile(outputPath);
  return { width: info.width, height: info.height };
}

export async function applyOps(inputPath: string, ops: Op[]): Promise<{ buffer: Buffer; mimeType: string }> {
  let pipeline = sharp(inputPath);

  for (const op of ops) {
    switch (op.type) {
      case "rotate":
        pipeline = pipeline.rotate(op.degrees);
        break;
      case "flip":
        pipeline = op.direction === "horizontal" ? pipeline.flop() : pipeline.flip();
        break;
      case "crop":
        pipeline = pipeline.extract({
          left: Math.round(op.x),
          top: Math.round(op.y),
          width: Math.round(op.width),
          height: Math.round(op.height),
        });
        break;
      case "resize":
        pipeline = pipeline.resize(op.width, op.height, { fit: "inside", withoutEnlargement: false });
        break;
      case "blur":
        pipeline = pipeline.blur(Math.max(0.3, op.radius));
        break;
      case "sharpen":
        pipeline = pipeline.sharpen({ sigma: op.amount });
        break;
    }
  }

  const buffer = await pipeline.jpeg({ quality: 95 }).toBuffer();
  return { buffer, mimeType: "image/jpeg" };
}
