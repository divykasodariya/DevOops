import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { chatWithAI, transcribeAudio, uploadDocument } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ── In-memory upload for audio transcription ─────────────────────────────────
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits:   { fileSize: 25 * 1024 * 1024 },
});

// ── Disk upload for documents ────────────────────────────────────────────────
const docDir = path.join(__dirname, '..', 'uploads', 'documents');
if (!fs.existsSync(docDir)) {
  fs.mkdirSync(docDir, { recursive: true });
}

const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, docDir),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});
const docUpload = multer({ storage: docStorage, limits: { fileSize: 50 * 1024 * 1024 } });

// POST /ai/chat  — protected: requires JWT
router.route('/chat').post(protect, chatWithAI);

// POST /ai/transcribe — multipart field `audio`, protected
router.route('/transcribe').post(protect, memUpload.single('audio'), transcribeAudio);

// POST /ai/upload-doc — multipart field `document`, protected
router.route('/upload-doc').post(protect, docUpload.single('document'), uploadDocument);

export default router;
