// Image library sidebar: drag-and-drop / file picker upload with error feedback, scrollable list of image thumbnails, and delete confirmation.

import React, { useCallback, useState } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { fetchImages, uploadImages, deleteImage } from "../api/images";
import { useEditorStore } from "../store/editorStore";
import ImageCard from "./ImageCard";

export default function Sidebar() {
  const queryClient = useQueryClient();
  const { selectedImageId, selectImage, removeImage } = useEditorStore();

  const { data: images = [], isLoading } = useQuery({
    queryKey: ["images"],
    queryFn: fetchImages,
  });

  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: uploadImages,
    onSuccess: (newImages) => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["images"] });
      if (newImages.length > 0) selectImage(newImages[0].id);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : "Upload failed");
      setUploadError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteImage,
    onSuccess: (_data, id) => {
      removeImage(id);
      queryClient.invalidateQueries({ queryKey: ["images"] });
    },
  });

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) uploadMutation.mutate(files);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) uploadMutation.mutate(files);
    e.target.value = "";
  };

  return (
    <aside className="w-52 flex-shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col">
      <div className="p-3 border-b border-gray-700">
        <label
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:bg-gray-800/50 transition-all text-center"
        >
          <span className="text-2xl mb-1">+</span>
          <span className="text-xs text-gray-400">
            {uploadMutation.isPending ? "Uploading..." : "Drop images or click"}
          </span>
          <input type="file" multiple accept="image/*" className="hidden" onChange={onFileChange} />
        </label>
        {uploadError && (
          <div className="mt-2 text-xs text-red-400 bg-red-900/30 rounded p-2 break-words">
            {uploadError}
            <button className="ml-1 underline" onClick={() => setUploadError(null)}>dismiss</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading && <p className="text-gray-500 text-xs text-center mt-4">Loading...</p>}
        {images.map((img) => (
          <ImageCard
            key={img.id}
            image={img}
            selected={img.id === selectedImageId}
            onSelect={() => selectImage(img.id)}
            onDelete={() => {
              if (confirm(`Delete "${img.originalName}"?`)) deleteMutation.mutate(img.id);
            }}
          />
        ))}
      </div>
    </aside>
  );
}
