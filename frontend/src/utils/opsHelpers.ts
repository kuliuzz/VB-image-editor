// Utility functions for working with edit operations: computing current image dimensions, converting crop selections from percent coordinates to canvas buffer pixel coordinates, and transforming crop coordinates when a rotation or flip is applied.

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

// Transforms a crop rectangle to remain visually correct after a 90° or 270° rotation.
// stageWidth/stageHeight are the OLD stage1 dimensions (before the new rotation).
// flipH/flipV reflect the flips already present in that stage1 — the correct formula
// depends on whether an odd number of flips is active (XOR), because each flip
// transposes which coordinate formula applies.
export function transformCropForRotation(
  crop: CropOp,
  rotationDelta: 90 | 270,
  stageWidth: number,
  stageHeight: number,
  flipH: boolean,
  flipV: boolean
): CropOp {
  // XOR of the two flip flags: true when exactly one flip is active
  const oddFlips = flipH !== flipV;
  // Formula choice alternates with both the rotation direction and the flip parity
  const useFormula1 = (rotationDelta === 90) !== oddFlips;

  if (useFormula1) {
    return { type: "crop", x: stageHeight - crop.y - crop.height, y: crop.x, width: crop.height, height: crop.width };
  }
  return { type: "crop", x: crop.y, y: stageWidth - crop.x - crop.width, width: crop.height, height: crop.width };
}

// Transforms a crop rectangle to remain visually correct after a horizontal or vertical flip.
// Since flip is its own inverse, this same function handles both applying and removing a flip.
export function transformCropForFlip(
  crop: CropOp,
  direction: "horizontal" | "vertical",
  stageWidth: number,
  stageHeight: number
): CropOp {
  if (direction === "horizontal") {
    return { type: "crop", x: stageWidth - crop.x - crop.width, y: crop.y, width: crop.width, height: crop.height };
  }
  return { type: "crop", x: crop.x, y: stageHeight - crop.y - crop.height, width: crop.width, height: crop.height };
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
