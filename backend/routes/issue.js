import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { createIssue, getMyIssues, getAllIssues } from '../controllers/issueController.js';

const router = express.Router();

router
  .route('/all')
  .get(protect, authorize('admin', 'principal', 'support'), getAllIssues);

router.route('/')
  .post(protect, createIssue);

router.route('/my')
  .get(protect, getMyIssues);

export default router;
