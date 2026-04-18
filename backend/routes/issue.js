import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createIssue, getMyIssues } from '../controllers/issueController.js';

const router = express.Router();

router.route('/')
  .post(protect, createIssue);

router.route('/my')
  .get(protect, getMyIssues);

export default router;
