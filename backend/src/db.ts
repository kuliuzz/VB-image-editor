// PostgreSQL connection pool and schema initialisation. Runs CREATE TABLE IF NOT EXISTS on startup so no separate migration step is needed.

import { Pool } from "pg";

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS images (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      filename     TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type    TEXT NOT NULL,
      width        INTEGER NOT NULL,
      height       INTEGER NOT NULL,
      size_bytes   INTEGER NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS edit_history (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      image_id   UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      ops        JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(image_id)
    );
  `);
}
