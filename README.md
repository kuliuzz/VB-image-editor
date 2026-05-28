# Image Editor

A web-based image editor with a persistent library, non-destructive edits, and full undo/redo support.

---

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

No other dependencies need to be installed locally.

---

## Installation

**1. Clone the repository**

```bash
git clone <repo-url>
cd <project-folder>
```

**2. Create your environment file**

```bash
cp .env.example .env
```

Open `.env` and set a secure database password:

```
POSTGRES_DB=imagedb
POSTGRES_USER=imageuser
POSTGRES_PASSWORD=your_password_here
```

---

## Starting the app

**First run** (builds Docker images, takes a few minutes):

```bash
docker compose up --build
```

**Subsequent runs:**

```bash
docker compose up
```

**Run in the background:**

```bash
docker compose up -d
```

Once running, open **http://localhost** in your browser.

---

## Stopping

| Command | Effect |
|---|---|
| `docker compose down` | Stop containers, keep data |
| `docker compose down -v` | Stop containers and **delete all data** (images + database) |
| `docker compose restart` | Restart all containers without rebuilding |

---

## Services

| Service | URL | Description |
|---|---|---|
| App | http://localhost | React frontend |
| Adminer | http://localhost:8080 | Database browser |
| Backend API | http://localhost:3001 | REST API (internal use) |

**Adminer login:** System `PostgreSQL` · Server `db` · User and password from your `.env`

---

## Features

- Upload one or more images (JPEG, PNG, WebP, AVIF, GIF, TIFF, BMP — up to 100 MB each)
- Image library with thumbnails, drag-and-drop upload
- Non-destructive editing: Rotate, Flip, Crop, Resize (with aspect ratio lock), Blur, Sharpen
- Undo / Redo with 50-step history (Ctrl+Z / Ctrl+Y)
- Auto-save with visual indicator
- Download edited image (processed server-side at full quality)

---

## Architecture

The app is split into four Docker services:

```
Browser → nginx (port 80)
              ├── /          → React SPA (built static files)
              └── /api/*     → Node.js backend (port 3001)
                                    └── PostgreSQL (port 5432)
                                    └── uploads volume (originals + thumbnails)
```

**Preview / processing split**

All edits are stored as a JSON array of operations (`rotate`, `flip`, `crop`, `resize`, `blur`, `sharpen`). The frontend applies these instantly using the Canvas API for a real-time preview — no network round-trip during editing. On download, the backend replays the same operation sequence using [Sharp](https://sharp.pixelplumbing.com/) against the original file, producing a high-quality output.

**Frontend** (`frontend/`) — React + TypeScript + Vite + TailwindCSS

- `store/editorStore.ts` — Zustand store holding the operation history stack, undo/redo index, and selected image state
- `utils/canvasRenderer.ts` — pure function that applies all ops to a canvas in a fixed order (rotate → flip → crop → resize → blur/sharpen), reusing a pool of offscreen canvases
- `hooks/useCanvasPreview.ts` — drives canvas re-render on every ops change
- `components/` — Editor, Toolbar, Sidebar, CropOverlay, ErrorBoundary

**Backend** (`backend/`) — Node.js + Express + TypeScript

- `routes/images.ts` — REST endpoints for upload, library, ops persistence, download, delete
- `services/sharpService.ts` — Sharp pipeline: EXIF normalisation on upload, thumbnail generation, full edit pipeline on download
- `db.ts` — PostgreSQL pool; schema created on startup via `CREATE TABLE IF NOT EXISTS`

**Database schema**

```
images         — id, filename (UUID on disk), original_name, mime_type, dimensions, size, created_at
edit_history   — image_id (FK), ops (JSONB array), updated_at
```

Each image has exactly one `edit_history` row (enforced by a `UNIQUE` constraint), updated via upsert.
