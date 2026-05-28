// Utility functions for working with edit operations: computing current image dimensions, converting crop selections from percent coordinates to canvas buffer pixel coordinates, and transforming crop coordinates when a rotation is applied.

import { Op, RotateOp, CropOp } from "../types";

export function getEffectiveDimensions(
  naturalWidth: number,
  naturalHeight: number,
  ops: Op[]
): { width: number; height: number } {
  const rotateOp = ops.find((o): o is RotateOp => o.type === "rotate");
  const cropOp   = ops.find((o): o is CropOp   => o.type === "crop");

  const rotationDegrees   = rotateOp?.degrees ?? 0;
  const dimensionsSwapped = rotationDegrees === 90 || rotationDegrees === 270;
  const rotatedWidth  = dimensionsSwapped ? naturalHeight : naturalWidth;
  const rotatedHeight = dimensionsSwapped ? naturalWidth  : naturalHeight;

  if (cropOp) {
    return { width: Math.round(cropOp.width), height: Math.round(cropOp.height) };
  }
  return { width: rotatedWidth, height: rotatedHeight };
}

// Transforms a crop rectangle to remain visually correct after a 90° rotation.
// stageWidth/stageHeight are the canvas dimensions BEFORE the new rotation is applied.
export function transformCropForRotation(
  crop: CropOp,
  rotationDelta: 90 | 270,
  stageWidth: number,
  stageHeight: number
): CropOp {
  if (rotationDelta === 90) {
    // 90° CW: pixel (sx, sy) → (stageHeight − sy − 1, sx)
    return {
      type: "crop",
      x: stageHeight - crop.y - crop.height,
      y: crop.x,
      width: crop.height,
      height: crop.width,
    };
  }
  // 270° CW (90° CCW): pixel (sx, sy) → (sy, stageWidth − sx − 1)
  return {
    type: "crop",
    x: crop.y,
    y: stageWidth - crop.x - crop.width,
    width: crop.height,
    height: crop.width,
  };
}

export function cropPercentToPixels(
  percentCrop: { x: number; y: number; width: number; height: number },
  canvasBufferWidth: number,
  canvasBufferHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x:      (percentCrop.x      / 100) * canvasBufferWidth,
    y:      (percentCrop.y      / 100) * canvasBufferHeight,
    width:  (percentCrop.width  / 100) * canvasBufferWidth,
    height: (percentCrop.height / 100) * canvasBufferHeight,
  };
}
