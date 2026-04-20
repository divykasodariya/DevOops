import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { imposeFine } from '../controllers/paymentController.js';

const router = express.Router();

router.route('/').post(protect, authorize('admin', 'principal'), imposeFine);

export default router;
