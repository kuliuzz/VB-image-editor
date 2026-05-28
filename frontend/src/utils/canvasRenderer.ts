// Pure canvas rendering pipeline: applies edit operations (rotate, flip, crop, resize, blur, sharpen) to a source image in a defined order, reusing a pool of offscreen canvases to minimise garbage collection.

import { Op, RotateOp, FlipOp, CropOp, ResizeOp, BlurOp, SharpenOp } from "../types";

export interface CanvasPool {
  rotateFlipCanvas: HTMLCanvasElement;
  cropCanvas: HTMLCanvasElement;
  resizeCanvas: HTMLCanvasElement;
}

export function createCanvasPool(): CanvasPool {
  return {
    rotateFlipCanvas: document.createElement("canvas"),
    cropCanvas:       document.createElement("canvas"),
    resizeCanvas:     document.createElement("canvas"),
  };
}

export function renderToCanvas(
  canvas: HTMLCanvasElement,
  sourceImage: HTMLImageElement,
  ops: Op[],
  pool?: CanvasPool
): void {
  const rotateOp  = ops.find((o): o is RotateOp  => o.type === "rotate");
  const flipHOp   = ops.find((o): o is FlipOp    => o.type === "flip" && o.direction === "horizontal");
  const flipVOp   = ops.find((o): o is FlipOp    => o.type === "flip" && o.direction === "vertical");
  const cropOp    = ops.find((o): o is CropOp    => o.type === "crop");
  const resizeOp  = ops.find((o): o is ResizeOp  => o.type === "resize");
  const blurOp    = ops.find((o): o is BlurOp    => o.type === "blur");
  const sharpenOp = ops.find((o): o is SharpenOp => o.type === "sharpen");

  const sourceWidth  = sourceImage.naturalWidth;
  const sourceHeight = sourceImage.naturalHeight;

  // Stage 1: rotate + flip
  const rotationDegrees    = rotateOp?.degrees ?? 0;
  const dimensionsSwapped  = rotationDegrees === 90 || rotationDegrees === 270;
  const rotatedWidth  = dimensionsSwapped ? sourceHeight : sourceWidth;
  const rotatedHeight = dimensionsSwapped ? sourceWidth  : sourceHeight;

  const rotateFlipCanvas = pool?.rotateFlipCanvas ?? document.createElement("canvas");
  rotateFlipCanvas.width  = rotatedWidth;
  rotateFlipCanvas.height = rotatedHeight;
  const rotateFlipCtx = rotateFlipCanvas.getContext("2d")!;
  rotateFlipCtx.save();
  rotateFlipCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
  if (rotationDegrees) rotateFlipCtx.rotate((rotationDegrees * Math.PI) / 180);
  if (flipHOp) rotateFlipCtx.scale(-1,  1);
  if (flipVOp) rotateFlipCtx.scale( 1, -1);
  rotateFlipCtx.drawImage(sourceImage, -sourceWidth / 2, -sourceHeight / 2);
  rotateFlipCtx.restore();

  // Stage 2: crop
  let workingCanvas: HTMLCanvasElement = rotateFlipCanvas;
  if (cropOp) {
    const cropLeft   = Math.max(0, Math.round(cropOp.x));
    const cropTop    = Math.max(0, Math.round(cropOp.y));
    const clampedCropWidth  = Math.min(Math.round(cropOp.width),  rotateFlipCanvas.width  - cropLeft);
    const clampedCropHeight = Math.min(Math.round(cropOp.height), rotateFlipCanvas.height - cropTop);
    const cropCanvas = pool?.cropCanvas ?? document.createElement("canvas");
    cropCanvas.width  = clampedCropWidth;
    cropCanvas.height = clampedCropHeight;
    cropCanvas.getContext("2d")!.drawImage(rotateFlipCanvas, cropLeft, cropTop, clampedCropWidth, clampedCropHeight, 0, 0, clampedCropWidth, clampedCropHeight);
    workingCanvas = cropCanvas;
  }

  // Stage 3: resize
  if (resizeOp) {
    const resizeCanvas = pool?.resizeCanvas ?? document.createElement("canvas");
    resizeCanvas.width  = resizeOp.width;
    resizeCanvas.height = resizeOp.height;
    resizeCanvas.getContext("2d")!.drawImage(workingCanvas, 0, 0, resizeOp.width, resizeOp.height);
    workingCanvas = resizeCanvas;
  }

  // Write to display canvas
  canvas.width  = workingCanvas.width;
  canvas.height = workingCanvas.height;
  canvas.getContext("2d")!.drawImage(workingCanvas, 0, 0);

  // Blur/sharpen via CSS filter (GPU, zero canvas cost)
  const cssFilters: string[] = [];
  if (blurOp    && blurOp.radius    > 0) cssFilters.push(`blur(${blurOp.radius}px)`);
  if (sharpenOp && sharpenOp.amount > 0) cssFilters.push(`contrast(${1 + sharpenOp.amount * 0.15}) saturate(${1 + sharpenOp.amount * 0.05})`);
  canvas.style.filter = cssFilters.join(" ") || "none";
}
