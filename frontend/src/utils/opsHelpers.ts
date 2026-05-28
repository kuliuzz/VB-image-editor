// Utility functions for working with edit operations: computing current image dimensions and converting crop selections from percent coordinates to canvas buffer pixel coordinates.

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
