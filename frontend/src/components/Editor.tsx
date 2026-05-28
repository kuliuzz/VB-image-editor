// Main editor panel: displays the canvas preview, handles image loading, undo/redo (including keyboard shortcuts), debounced auto-save, crop mode, download with loading state, and the history limit warning modal.

import React, { useRef, useEffect, useState } from "react";
import { useEditorStore, currentOps } from "../store/editorStore";
import { fetchImage, saveOps, downloadUrl, originalUrl } from "../api/images";
import { useCanvasPreview } from "../hooks/useCanvasPreview";
import { useDebounce } from "../hooks/useDebounce";
import { renderToCanvas } from "../utils/canvasRenderer";
import Toolbar from "./Toolbar";
import CropOverlay from "./CropOverlay";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function Editor() {
  const store = useEditorStore();
  const {
    selectedImageId, sourceImage, setSourceImage, setOps, pushOp,
    undo, redo, historyIndex, opsHistory,
    showHistoryWarning, dismissHistoryWarning,
  } = store;
  const ops = currentOps(store);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [preCropCanvas, setPreCropCanvas] = useState<HTMLCanvasElement | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < opsHistory.length - 1;

  // #13 — keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const enterCropMode = () => {
    if (!sourceImage) return;
    // Render with rotate + flip + existing crop so the user sees their current
    // cropped state and can refine it, not the full original image.
    const previewOps = ops.filter((o) => o.type === "rotate" || o.type === "flip" || o.type === "crop");
    const tempCanvas = document.createElement("canvas");
    renderToCanvas(tempCanvas, sourceImage, previewOps);
    setPreCropCanvas(tempCanvas);
    setCropMode(true);
  };

  // Load image + ops when selection changes
  useEffect(() => {
    if (!selectedImageId) return;
    let cancelled = false;
    setLoading(true);
    setCropMode(false);
    setSaveStatus("idle");

    fetchImage(selectedImageId).then(({ ops: loadedOps }) => {
      if (!cancelled) setOps(loadedOps);
    });

    const img = new Image();
    img.src = originalUrl(selectedImageId);
    img.onload = () => {
      if (!cancelled) { setSourceImage(img); setLoading(false); }
    };
    img.onerror = () => { if (!cancelled) setLoading(false); };

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [selectedImageId]);

  useCanvasPreview(canvasRef, sourceImage, ops);

  // #16 — save indicator: show "saving" as soon as debounce fires, then "saved"/"error"
  useDebounce(ops, 800, (currentOps) => {
    if (!selectedImageId) return;
    setSaveStatus("saving");
    saveOps(selectedImageId, currentOps)
      .then(() => {
        setSaveStatus("saved");
        if (saveResetTimer.current) clearTimeout(saveResetTimer.current);
        saveResetTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
      })
      .catch(() => setSaveStatus("error"));
  });

  // #17 — download with loading state
  const handleDownload = async () => {
    if (!selectedImageId || downloading) return;
    setDownloading(true);
    setDownloadError(false);
    try {
      const resp = await fetch(downloadUrl(selectedImageId));
      if (!resp.ok) throw new Error("Server error");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(true);
      setTimeout(() => setDownloadError(false), 3000);
    } finally {
      setDownloading(false);
    }
  };

  if (!selectedImageId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-5xl mb-4">🖼</div>
          <p>Select an image from the sidebar to start editing</p>
          <p className="text-xs mt-2 text-gray-600">Ctrl+Z / Ctrl+Y for undo / redo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-700">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ↩ Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ↪ Redo
        </button>

        {/* #16 — save status */}
        <span className="text-xs ml-2 w-20">
          {saveStatus === "saving" && <span className="text-gray-400">Saving…</span>}
          {saveStatus === "saved"  && <span className="text-green-400">Saved ✓</span>}
          {saveStatus === "error"  && <span className="text-red-400">Save failed</span>}
        </span>

        <div className="flex-1" />

        {/* #17 — download button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            downloadError
              ? "bg-red-600 hover:bg-red-500"
              : "bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
          }`}
        >
          {downloading ? "Processing…" : downloadError ? "Failed — retry" : "↓ Download"}
        </button>
      </div>

      {/* History limit warning modal */}
      {showHistoryWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className="text-white font-semibold text-base mb-2">Edit history limit reached</h3>
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              You've reached 50 history steps. From now on, each new edit will remove the oldest step from your undo history.
            </p>
            <button
              onClick={dismissHistoryWarning}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-950 p-4 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 z-20">
            <div className="text-gray-400">Loading…</div>
          </div>
        )}

        {cropMode && preCropCanvas && (
          <CropOverlay
            sourceCanvas={preCropCanvas}
            onApply={(newCrop) => {
              const existingCrop = ops.find((o) => o.type === "crop") as { type: "crop"; x: number; y: number; width: number; height: number } | undefined;
              // New crop coordinates are relative to the currently-cropped image,
              // so offset by the existing crop's origin to get stage1 coordinates.
              pushOp({
                type: "crop",
                x: (existingCrop?.x ?? 0) + newCrop.x,
                y: (existingCrop?.y ?? 0) + newCrop.y,
                width: newCrop.width,
                height: newCrop.height,
              });
              setCropMode(false);
            }}
            onCancel={() => setCropMode(false)}
          />
        )}

        <div className="overflow-hidden shadow-2xl max-w-full max-h-full flex-shrink-0" style={{ lineHeight: 0 }}>
          <canvas ref={canvasRef} className="max-w-full max-h-full block" style={{ imageRendering: "auto" }} />
        </div>
      </div>

      {/* Toolbar */}
      {sourceImage && (
        <Toolbar
          cropMode={cropMode}
          onCropMode={() => (cropMode ? setCropMode(false) : enterCropMode())}
          canvasRef={canvasRef}
        />
      )}
    </div>
  );
}
