// All API calls related to images: fetching the library, uploading, saving edit ops, downloading, and deleting.

import client from "./client";
import { ImageMeta, Op } from "../types";

export async function fetchImages(): Promise<ImageMeta[]> {
  const { data } = await client.get("/images");
  return data.images;
}

export async function fetchImage(id: string): Promise<{ image: ImageMeta; ops: Op[] }> {
  const { data } = await client.get(`/images/${id}`);
  return data;
}

export async function uploadImages(files: File[]): Promise<ImageMeta[]> {
  const form = new FormData();
  files.forEach((f) => form.append("images", f));
  const { data } = await client.post("/images", form);
  return data.images;
}

export async function saveOps(id: string, ops: Op[]): Promise<void> {
  await client.put(`/images/${id}/ops`, { ops });
}

export async function deleteImage(id: string): Promise<void> {
  await client.delete(`/images/${id}`);
}

export function downloadUrl(id: string): string {
  return `/api/images/${id}/download`;
}

export function originalUrl(id: string): string {
  return `/api/images/${id}/original`;
}
