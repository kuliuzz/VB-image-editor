// Shared TypeScript types for image operations and image metadata used across backend routes and services.

export type RotateOp = { type: "rotate"; degrees: 90 | 180 | 270 };
export type FlipOp = { type: "flip"; direction: "horizontal" | "vertical" };
export type CropOp = { type: "crop"; x: number; y: number; width: number; height: number };
export type ResizeOp = { type: "resize"; width: number; height: number };
export type BlurOp = { type: "blur"; radius: number };
export type SharpenOp = { type: "sharpen"; amount: number };

export type Op = RotateOp | FlipOp | CropOp | ResizeOp | BlurOp | SharpenOp;

export interface ImageMeta {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
  thumbnailUrl: string;
}
