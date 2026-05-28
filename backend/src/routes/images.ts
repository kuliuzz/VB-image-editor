// REST API routes for image management: upload, list, serve originals and thumbnails, save/load edit operations, process and download edited images, and delete.

import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { pool } from "../db";
import { upload } from "../middleware/upload";
import { generateThumbnail, normalizeOrientation, applyOps } from "../services/sharpService";
import { Op } from "../types";

const MAX_DIM = 16000;

function validateOps(ops: unknown): ops is Op[] {
  if (!Array.isArray(ops)) return false;
  return ops.every((op: unknown) => {
    if (!op || typeof op !== "object") return false;
    const opRecord = op as Record<string, unknown>;
    switch (opRecord.type) {
      case "rotate": return [90, 180, 270].includes(opRecord.degrees as number);
      case "flip":   return opRecord.direction === "horizontal" || opRecord.direction === "vertical";
      case "crop":
        return [opRecord.x, opRecord.y, opRecord.width, opRecord.height].every((coordinate) => typeof coordinate === "number" && coordinate >= 0)
          && (opRecord.width as number) > 0 && (opRecord.width as number) <= MAX_DIM
          && (opRecord.height as number) > 0 && (opRecord.height as number) <= MAX_DIM;
      case "resize":
        return typeof opRecord.width === "number" && opRecord.width > 0 && opRecord.width <= MAX_DIM
          && typeof opRecord.height === "number" && opRecord.height > 0 && opRecord.height <= MAX_DIM;
      case "blur":    return typeof opRecord.radius === "number" && opRecord.radius >= 0 && opRecord.radius <= 100;
      case "sharpen": return typeof opRecord.amount === "number" && opRecord.amount >= 0 && opRecord.amount <= 20;
      default: return false;
    }
  });
}

const router = Router();
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "/app/uploads");
const originalsDir = path.join(uploadDir, "originals");
const thumbsDir = path.join(uploadDir, "thumbnails");

function runUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.array("images")(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

router.post("/", async (req: Request, res: Response) => {
  try {
    await runUpload(req, res);
  } catch (err: unknown) {
    const errorMessage = err instanceof multer.MulterError
      ? err.code === "LIMIT_FILE_SIZE" ? "File too large (max 100 MB)" : err.message
      : err instanceof Error ? err.message : "Upload failed";
    res.status(400).json({ error: errorMessage });
    return;
  }
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }

  const uploadedImages = [];
  const uploadErrors: string[] = [];

  for (const file of files) {
    const rawPath = file.path;
    const normalizedPath = rawPath + "_norm";
    const thumbPath = path.join(thumbsDir, file.filename + ".jpg");
    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");

    const client = await pool.connect();
    try {
      const { width, height } = await normalizeOrientation(rawPath, normalizedPath);
      fs.renameSync(normalizedPath, rawPath);
      await generateThumbnail(rawPath, thumbPath);

      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO images (filename, original_name, mime_type, width, height, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [file.filename, originalName, file.mimetype, width, height, file.size]
      );
      const image = rows[0];
      await client.query(
        `INSERT INTO edit_history (image_id, ops) VALUES ($1, '[]')`,
        [image.id]
      );
      await client.query("COMMIT");

      uploadedImages.push(toMeta(image));
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      fs.unlink(rawPath, () => {});
      fs.unlink(normalizedPath, () => {});
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      uploadErrors.push(`${originalName}: ${errorMessage}`);
      console.error("Upload error for", originalName, err);
    } finally {
      client.release();
    }
  }

  if (uploadedImages.length === 0 && uploadErrors.length > 0) {
    res.status(422).json({ error: uploadErrors.join("; ") });
    return;
  }

  res.json({ images: uploadedImages, errors: uploadErrors.length > 0 ? uploadErrors : undefined });
});

router.get("/", async (_req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT i.*, eh.ops FROM images i
     LEFT JOIN edit_history eh ON eh.image_id = i.id
     ORDER BY i.created_at DESC`
  );
  res.json({ images: rows.map(toMeta) });
});

router.get("/:id", async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT i.*, eh.ops FROM images i
     LEFT JOIN edit_history eh ON eh.image_id = i.id
     WHERE i.id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  const row = rows[0];
  res.json({ image: toMeta(row), ops: row.ops || [] });
});

router.get("/:id/thumbnail", async (req: Request, res: Response) => {
  const { rows } = await pool.query("SELECT filename FROM images WHERE id = $1", [req.params.id]);
  if (rows.length === 0) { res.status(404).end(); return; }
  const thumbPath = path.join(thumbsDir, rows[0].filename + ".jpg");
  if (!fs.existsSync(thumbPath)) { res.status(404).end(); return; }
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile(thumbPath);
});

router.get("/:id/original", async (req: Request, res: Response) => {
  const { rows } = await pool.query("SELECT filename, mime_type FROM images WHERE id = $1", [req.params.id]);
  if (rows.length === 0) { res.status(404).end(); return; }
  const filePath = path.join(originalsDir, rows[0].filename);
  if (!fs.existsSync(filePath)) { res.status(404).end(); return; }
  res.setHeader("Content-Type", rows[0].mime_type);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.sendFile(filePath);
});

router.put("/:id/ops", async (req: Request, res: Response) => {
  const { ops } = req.body;
  if (!validateOps(ops)) {
    res.status(400).json({ error: "Invalid ops payload" });
    return;
  }
  await pool.query(
    `INSERT INTO edit_history (image_id, ops, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (image_id) DO UPDATE SET ops = EXCLUDED.ops, updated_at = now()`,
    [req.params.id, JSON.stringify(ops)]
  );
  res.status(204).end();
});

router.get("/:id/download", async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT i.filename, i.original_name, eh.ops FROM images i
     LEFT JOIN edit_history eh ON eh.image_id = i.id
     WHERE i.id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }

  const { filename, original_name, ops } = rows[0];
  const filePath = path.join(originalsDir, filename);

  try {
    const { buffer, mimeType } = await applyOps(filePath, ops || []);
    const ext = mimeType === "image/jpeg" ? ".jpg" : ".png";
    const outName = original_name.replace(/\.[^.]+$/, "") + "_edited" + ext;
    const encodedName = encodeURIComponent(outName).replace(/'/g, "%27");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="edited.jpg"; filename*=UTF-8''${encodedName}`);
    res.send(buffer);
  } catch (err) {
    console.error("Download processing error:", err);
    res.status(500).json({ error: "Failed to process image for download" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const { rows } = await pool.query("SELECT filename FROM images WHERE id = $1", [req.params.id]);
  if (rows.length === 0) { res.status(404).end(); return; }
  const { filename } = rows[0];

  await pool.query("DELETE FROM images WHERE id = $1", [req.params.id]);

  fs.unlink(path.join(originalsDir, filename), () => {});
  fs.unlink(path.join(thumbsDir, filename + ".jpg"), () => {});

  res.status(204).end();
});

function toMeta(row: Record<string, unknown>) {
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    thumbnailUrl: `/api/images/${row.id}/thumbnail`,
  };
}

export default router;
