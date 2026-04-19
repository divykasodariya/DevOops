import express from 'express';
import multer from 'multer';
import { chatWithAI, transcribeAudio } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// POST /ai/chat  — protected: requires JWT
router.route('/chat').post(protect, chatWithAI);

// POST /ai/transcribe — multipart field `audio`, protected
router.route('/transcribe').post(protect, upload.single('audio'), transcribeAudio);

export default router;
