// Express app entry point. Configures CORS, rate limiting, mounts the images router, creates upload directories, and initialises the database before starting the server.

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { rateLimit } from "express-rate-limit";
import { initDb } from "./db";
import imagesRouter from "./routes/images";

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// General API limiter: 300 req/min per IP
app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down" },
}));

// Tighter limit on uploads: 30 req/min per IP
app.use("/api/images", rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload requests, please try again later" },
  skip: (req) => req.method !== "POST",
}));

app.use("/api/images", imagesRouter);

async function start() {
  const uploadDir = process.env.UPLOAD_DIR || "/app/uploads";
  fs.mkdirSync(path.join(uploadDir, "originals"), { recursive: true });
  fs.mkdirSync(path.join(uploadDir, "thumbnails"), { recursive: true });

  await initDb();
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
