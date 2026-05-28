// Hook that re-renders the editor canvas whenever the source image or edit operations change, reusing a persistent offscreen canvas pool to avoid repeated allocations.

import { useEffect, useRef, RefObject } from "react";
import { Op } from "../types";
import { renderToCanvas, createCanvasPool, type CanvasPool } from "../utils/canvasRenderer";

export function useCanvasPreview(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  sourceImage: HTMLImageElement | null,
  ops: Op[]
) {
  const poolRef = useRef<CanvasPool | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImage) return;
    if (!poolRef.current) poolRef.current = createCanvasPool();
    renderToCanvas(canvas, sourceImage, ops, poolRef.current);
  }, [canvasRef, sourceImage, ops]);
}
