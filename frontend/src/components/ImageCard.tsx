// Thumbnail card for a single image in the library sidebar: shows the image, highlights when selected, and reveals a delete button on hover.

import React from "react";
import { ImageMeta } from "../types";

interface Props {
  image: ImageMeta;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export default function ImageCard({ image, selected, onSelect, onDelete }: Props) {
  return (
    <div
      onClick={onSelect}
      className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
        selected ? "border-blue-500" : "border-transparent hover:border-gray-500"
      }`}
    >
      <img
        src={image.thumbnailUrl}
        alt={image.originalName}
        className="w-full h-24 object-cover bg-gray-800"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500"
        title="Delete"
      >
        ×
      </button>
      <p className="text-xs text-gray-400 truncate px-1 py-0.5 bg-gray-900/80">
        {image.originalName}
      </p>
    </div>
  );
}
