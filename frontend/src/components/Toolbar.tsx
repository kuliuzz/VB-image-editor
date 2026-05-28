// Edit controls toolbar: rotate, flip, crop, resize (with aspect ratio lock), blur, and sharpen. Blur/sharpen use local state for instant visual feedback and only commit to history on pointer release.

import React, { useState, useEffect, useRef, RefObject } from "react";
import { useEditorStore, currentOps } from "../store/editorStore";
import { Op, CropOp, RotateOp } from "../types";
import { getEffectiveDimensions, transformCropForRotation } from "../utils/opsHelpers";

interface Props {
  onCropMode: () => void;
  cropMode: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export default function Toolbar({ onCropMode, cropMode, canvasRef }: Props) {
  const store = useEditorStore();
  const ops = currentOps(store);

  const blurOp    = ops.find((o) => o.type === "blur")    as { type: "blur";    radius: number } | undefined;
  const sharpenOp = ops.find((o) => o.type === "sharpen") as { type: "sharpen"; amount: number } | undefined;
  const resizeOp  = ops.find((o) => o.type === "resize")  as { type: "resize";  width: number; height: number } | undefined;
  const cropOp    = ops.find((o): o is CropOp => o.type === "crop");

  const sourceImage  = store.sourceImage;
  const effectiveDims = sourceImage
    ? getEffectiveDimensions(sourceImage.naturalWidth, sourceImage.naturalHeight, ops)
    : null;

  // Resize inputs
  const [resizeW, setResizeW] = useState(resizeOp?.width.toString()  ?? effectiveDims?.width.toString()  ?? "");
  const [resizeH, setResizeH] = useState(resizeOp?.height.toString() ?? effectiveDims?.height.toString() ?? "");
  const [arLocked, setArLocked] = useState(true);

  useEffect(() => {
    if (resizeOp) {
      setResizeW(resizeOp.width.toString());
      setResizeH(resizeOp.height.toString());
    } else if (effectiveDims) {
      setResizeW(effectiveDims.width.toString());
      setResizeH(effectiveDims.height.toString());
    }
  }, [resizeOp?.width, resizeOp?.height, effectiveDims?.width, effectiveDims?.height]);

  const handleResizeW = (val: string) => {
    setResizeW(val);
    if (arLocked && effectiveDims) {
      const w = parseInt(val);
      if (w > 0) setResizeH(Math.round(w * effectiveDims.height / effectiveDims.width).toString());
    }
  };

  const handleResizeH = (val: string) => {
    setResizeH(val);
    if (arLocked && effectiveDims) {
      const h = parseInt(val);
      if (h > 0) setResizeW(Math.round(h * effectiveDims.width / effectiveDims.height).toString());
    }
  };

  const handleRotate = (degrees: 90 | 270) => {
    const existingCrop   = ops.find((op): op is CropOp   => op.type === "crop");
    const existingRotate = ops.find((op): op is RotateOp => op.type === "rotate");

    if (existingCrop && sourceImage) {
      // Compute stage1 dimensions with the CURRENT (pre-new-rotation) total rotation
      const currentDegrees    = existingRotate?.degrees ?? 0;
      const dimensionsSwapped = currentDegrees === 90 || currentDegrees === 270;
      const stageWidth  = dimensionsSwapped ? sourceImage.naturalHeight : sourceImage.naturalWidth;
      const stageHeight = dimensionsSwapped ? sourceImage.naturalWidth  : sourceImage.naturalHeight;

      // Compute new total rotation
      const newDegrees = ((currentDegrees + degrees) % 360) as 0 | 90 | 180 | 270;

      // Transform crop to the new coordinate space and update both ops atomically
      const transformedCrop = transformCropForRotation(existingCrop, degrees, stageWidth, stageHeight);
      const opsWithoutRotateAndCrop = ops.filter((op) => op.type !== "rotate" && op.type !== "crop");
      const updatedOps: Op[] = [
        ...opsWithoutRotateAndCrop,
        transformedCrop,
        ...(newDegrees !== 0 ? [{ type: "rotate" as const, degrees: newDegrees }] : []),
      ];
      store.pushOpsSnapshot(updatedOps);
    } else {
      store.pushOp({ type: "rotate", degrees });
    }
  };

  const applyResize = () => {
    const w = parseInt(resizeW);
    const h = parseInt(resizeH);
    if (w > 0 && h > 0) store.pushOp({ type: "resize", width: w, height: h });
  };

  // Blur / sharpen — local state, commit on pointer release
  const [localBlur, setLocalBlur]       = useState(blurOp?.radius  ?? 0);
  const [localSharpen, setLocalSharpen] = useState(sharpenOp?.amount ?? 0);
  const isInteracting = useRef(false);

  useEffect(() => { if (!isInteracting.current) setLocalBlur(blurOp?.radius ?? 0);      }, [blurOp?.radius]);
  useEffect(() => { if (!isInteracting.current) setLocalSharpen(sharpenOp?.amount ?? 0); }, [sharpenOp?.amount]);

  const applyFilterToCanvas = (blur: number, sharpen: number) => {
    if (!canvasRef.current) return;
    const filters: string[] = [];
    if (blur > 0)    filters.push(`blur(${blur}px)`);
    if (sharpen > 0) filters.push(`contrast(${1 + sharpen * 0.15}) saturate(${1 + sharpen * 0.05})`);
    canvasRef.current.style.filter = filters.join(" ") || "none";
  };

  const commitBlur    = (v: number) => { isInteracting.current = false; v === 0 ? store.removeOpType("blur")    : store.pushOp({ type: "blur",    radius: v }); };
  const commitSharpen = (v: number) => { isInteracting.current = false; v === 0 ? store.removeOpType("sharpen") : store.pushOp({ type: "sharpen", amount: v }); };

  return (
    <div className="bg-gray-800 border-t border-gray-700 p-3 flex flex-wrap gap-4 items-start">

      {/* Rotate */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400 font-medium">Rotate</span>
        <div className="flex gap-1">
          <ToolBtn onClick={() => handleRotate(270)}>↺ Left</ToolBtn>
          <ToolBtn onClick={() => handleRotate(90)}>↻ Right</ToolBtn>
        </div>
      </div>

      {/* Flip */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400 font-medium">Flip</span>
        <div className="flex gap-1">
          <ToolBtn onClick={() => store.pushOp({ type: "flip", direction: "horizontal" })}>⇔ H</ToolBtn>
          <ToolBtn onClick={() => store.pushOp({ type: "flip", direction: "vertical"   })}>⇕ V</ToolBtn>
        </div>
      </div>

      {/* Crop — #15: remove button when crop is active */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400 font-medium">Crop</span>
        <div className="flex gap-1">
          <ToolBtn onClick={onCropMode} active={cropMode}>✂ Crop</ToolBtn>
          {cropOp && <ToolBtn onClick={() => store.removeOpType("crop")} title="Remove crop">✕</ToolBtn>}
        </div>
      </div>

      {/* Resize — #14: aspect ratio lock */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400 font-medium">
          Resize
          {effectiveDims && (
            <span className="ml-1 text-gray-500 font-normal">
              ({effectiveDims.width} × {effectiveDims.height})
            </span>
          )}
        </span>
        <div className="flex gap-1 items-center">
          <input
            type="number"
            value={resizeW}
            onChange={(e) => handleResizeW(e.target.value)}
            placeholder="W"
            className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
          />
          {/* AR lock toggle */}
          <button
            onClick={() => setArLocked((v) => !v)}
            title={arLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            className={`px-1.5 py-1 rounded text-xs transition-colors ${arLocked ? "bg-blue-700 text-blue-200" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
          >
            {arLocked ? "🔒" : "🔓"}
          </button>
          <input
            type="number"
            value={resizeH}
            onChange={(e) => handleResizeH(e.target.value)}
            placeholder="H"
            className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
          />
          <ToolBtn onClick={applyResize}>Apply</ToolBtn>
          {resizeOp && <ToolBtn onClick={() => store.removeOpType("resize")}>✕</ToolBtn>}
        </div>
      </div>

      {/* Blur */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400 font-medium">Blur: {localBlur.toFixed(1)}</span>
        <input
          type="range" min={0} max={20} step={0.5} value={localBlur}
          onPointerDown={() => { isInteracting.current = true; }}
          onChange={(e) => { const v = parseFloat(e.target.value); setLocalBlur(v); applyFilterToCanvas(v, localSharpen); }}
          onPointerUp={(e) => commitBlur(parseFloat((e.target as HTMLInputElement).value))}
          className="w-28 accent-blue-500"
        />
      </div>

      {/* Sharpen */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400 font-medium">Sharpen: {localSharpen.toFixed(1)}</span>
        <input
          type="range" min={0} max={5} step={0.1} value={localSharpen}
          onPointerDown={() => { isInteracting.current = true; }}
          onChange={(e) => { const v = parseFloat(e.target.value); setLocalSharpen(v); applyFilterToCanvas(localBlur, v); }}
          onPointerUp={(e) => commitSharpen(parseFloat((e.target as HTMLInputElement).value))}
          className="w-28 accent-blue-500"
        />
      </div>

    </div>
  );
}

function ToolBtn({ onClick, children, active, title }: {
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        active ? "bg-blue-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
