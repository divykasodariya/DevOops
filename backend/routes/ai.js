import express from 'express';
import { chatWithAI } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /ai/chat  — protected: requires JWT
router.route('/chat').post(protect, chatWithAI);

export default router;
