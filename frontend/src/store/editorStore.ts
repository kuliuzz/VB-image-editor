// Global editor state: image library, selected image, canvas source, non-destructive edit operation history with undo/redo, and a 50-step history cap.

import { create } from "zustand";
import { ImageMeta, Op, RotateOp, FlipOp } from "../types";

const HISTORY_LIMIT = 50;

interface EditorState {
  images: ImageMeta[];
  selectedImageId: string | null;
  sourceImage: HTMLImageElement | null;
  opsHistory: Op[][];
  historyIndex: number;
  showHistoryWarning: boolean;

  setImages: (images: ImageMeta[]) => void;
  addImages: (images: ImageMeta[]) => void;
  removeImage: (id: string) => void;
  selectImage: (id: string | null) => void;
  setSourceImage: (img: HTMLImageElement | null) => void;
  setOps: (ops: Op[]) => void;
  pushOp: (op: Op) => void;
  removeOpType: (type: Op["type"]) => void;
  dismissHistoryWarning: () => void;
  undo: () => void;
  redo: () => void;
  resetOps: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  images: [],
  selectedImageId: null,
  sourceImage: null,
  opsHistory: [[]],
  historyIndex: 0,
  showHistoryWarning: false,

  setImages: (images) => set({ images }),
  addImages: (newImages) => set((state) => ({ images: [...newImages, ...state.images] })),
  removeImage: (id) =>
    set((state) => ({
      images: state.images.filter((img) => img.id !== id),
      selectedImageId: state.selectedImageId === id ? null : state.selectedImageId,
    })),

  selectImage: (id) =>
    set({ selectedImageId: id, sourceImage: null, opsHistory: [[]], historyIndex: 0 }),

  setSourceImage: (img) => set({ sourceImage: img }),

  setOps: (ops) => set({ opsHistory: [ops], historyIndex: 0 }),

  pushOp: (op) =>
    set((state) => {
      const currentSnapshot = state.opsHistory[state.historyIndex];
      const updatedOps = mergeOp(currentSnapshot, op);
      let newHistory = [...state.opsHistory.slice(0, state.historyIndex + 1), updatedOps];

      const hitLimit = newHistory.length === HISTORY_LIMIT && !state.showHistoryWarning;
      if (newHistory.length > HISTORY_LIMIT) {
        newHistory = newHistory.slice(1);
      }

      return {
        opsHistory: newHistory,
        historyIndex: newHistory.length - 1,
        showHistoryWarning: hitLimit ? true : state.showHistoryWarning,
      };
    }),

  dismissHistoryWarning: () => set({ showHistoryWarning: false }),

  removeOpType: (type) =>
    set((state) => {
      const currentSnapshot = state.opsHistory[state.historyIndex];
      const updatedOps = currentSnapshot.filter((op) => op.type !== type);
      const newHistory = [...state.opsHistory.slice(0, state.historyIndex + 1), updatedOps];
      return { opsHistory: newHistory, historyIndex: newHistory.length - 1 };
    }),

  undo: () =>
    set((state) => ({ historyIndex: Math.max(0, state.historyIndex - 1) })),

  redo: () =>
    set((state) => ({ historyIndex: Math.min(state.opsHistory.length - 1, state.historyIndex + 1) })),

  resetOps: () => set({ opsHistory: [[]], historyIndex: 0 }),
}));

export function currentOps(s: EditorState): Op[] {
  return s.opsHistory[s.historyIndex] ?? [];
}

function mergeOp(ops: Op[], incomingOp: Op): Op[] {
  if (incomingOp.type === "rotate") {
    const existingRotate   = ops.find((op): op is RotateOp => op.type === "rotate");
    const previousDegrees  = existingRotate?.degrees ?? 0;
    const newDegrees       = ((previousDegrees + incomingOp.degrees) % 360) as 0 | 90 | 180 | 270;
    const opsWithoutRotate = ops.filter((op) => op.type !== "rotate");
    return newDegrees === 0 ? opsWithoutRotate : [...opsWithoutRotate, { type: "rotate", degrees: newDegrees }];
  }
  if (incomingOp.type === "flip") {
    const existingFlip       = ops.find((op): op is FlipOp => op.type === "flip" && op.direction === incomingOp.direction);
    const opsWithoutSameFlip = ops.filter((op) => !(op.type === "flip" && op.direction === incomingOp.direction));
    return existingFlip ? opsWithoutSameFlip : [...opsWithoutSameFlip, incomingOp];
  }
  const opsWithoutSameType = ops.filter((op) => op.type !== incomingOp.type);
  return [...opsWithoutSameType, incomingOp];
}
