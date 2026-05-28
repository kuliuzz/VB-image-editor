// Full-screen crop selection overlay: renders the pre-crop canvas as a data URL inside react-image-crop, tracks both the pixel crop (for UI) and the percent crop (for coordinate conversion), and returns buffer-space pixel coordinates on apply.

import React, { useState, useEffect } from "react";
import ReactCrop, { type Crop, type PercentCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { cropPercentToPixels } from "../utils/opsHelpers";

interface Props {
  sourceCanvas: HTMLCanvasElement;
  onApply: (crop: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

export default function CropOverlay({ sourceCanvas, onApply, onCancel }: Props) {
  const [dataUrl, setDataUrl] = useState("");
  // crop drives the ReactCrop UI (pixel coords of the displayed element)
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  // pctCrop holds scale-invariant percentages — what we actually use for apply
  const [pctCrop, setPctCrop] = useState<PercentCrop | undefined>(undefined);

  useEffect(() => {
    setDataUrl(sourceCanvas.toDataURL());
    const initial = centerCrop(
      makeAspectCrop(
        { unit: "%", width: 80 },
        sourceCanvas.width / sourceCanvas.height,
        sourceCanvas.width,
        sourceCanvas.height
      ),
      sourceCanvas.width,
      sourceCanvas.height
    ) as PercentCrop;
    setCrop(initial);
    setPctCrop(initial);
  }, [sourceCanvas]);

  const handleApply = () => {
    if (!pctCrop?.width || !pctCrop?.height) return;
    const pixels = cropPercentToPixels(
      { x: pctCrop.x, y: pctCrop.y, width: pctCrop.width, height: pctCrop.height },
      sourceCanvas.width,
      sourceCanvas.height
    );
    onApply(pixels);
  };

  if (!dataUrl) return null;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/85 z-50 p-6">
      <div className="flex flex-col items-center gap-4 max-w-full max-h-full">
        <ReactCrop
          crop={crop}
          onChange={(c, pct) => { setCrop(c); setPctCrop(pct); }}
          style={{ maxWidth: "calc(100vw - 3rem)", maxHeight: "calc(100vh - 8rem)" }}
        >
          <img
            src={dataUrl}
            alt="crop preview"
            style={{
              maxWidth: "calc(100vw - 3rem)",
              maxHeight: "calc(100vh - 8rem)",
              display: "block",
            }}
          />
        </ReactCrop>

        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={handleApply}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
          >
            Apply Crop
          </button>
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
