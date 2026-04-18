import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { setupProfile } from '../controllers/professorController.js';

const router = express.Router();

router.route('/setup').post(protect, authorize('professor'), setupProfile);

export default router;
